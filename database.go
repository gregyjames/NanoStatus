package main

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
)

// initDB initializes the database connection and runs migrations
func initDB() {
	var err error
	// Use pure Go SQLite driver (no CGO required)
	// Database path can be set via DB_PATH env var, defaults to ./nanostatus.db
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./nanostatus.db"
	}
	
	// Ensure the directory exists (for Docker volumes)
	if dir := filepath.Dir(dbPath); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Printf("Warning: Could not create database directory %s: %v", dir, err)
		}
	}
	
	// Enable WAL mode and configure connection pool for better concurrency
	// WAL mode allows multiple readers and one writer simultaneously
	// _busy_timeout sets how long to wait for locks (in milliseconds)
	dsn := dbPath + "?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=1"
	
	// Open database connection with modernc.org/sqlite
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}

	// Configure connection pool for SQLite (single connection recommended)
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	// Create GORM instance
	db, err = gorm.Open(sqlite.Dialector{Conn: sqlDB}, &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-migrate schemas
	if err := db.AutoMigrate(&Monitor{}, &CheckHistory{}); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	log.Printf("✅ Database initialized at %s", dbPath)

	// Always sync YAML config on startup (creates if empty, updates if changed)
	syncYAMLConfig(dbPath)
}

// syncYAMLConfig synchronizes monitors from YAML config with the database
// Looks for monitors.yaml in the same directory as the database
// Compares hashes to detect changes and updates monitors accordingly
func syncYAMLConfig(dbPath string) {
	// Look for monitors.yaml in the same directory as the database
	dbDir := filepath.Dir(dbPath)
	configPath := filepath.Join(dbDir, "monitors.yaml")
	
	// Try to load from YAML config file
	yamlMonitors, yamlHashes, err := loadMonitorsFromYAML(configPath)
	if err != nil {
		log.Printf("[Config] Failed to load YAML config from %s: %v", configPath, err)
	}
	
	// Get all existing monitors from database
	var existingMonitors []Monitor
	db.Find(&existingMonitors)
	
	// Create a map of existing monitors by config hash (only YAML-managed monitors)
	existingByHash := make(map[string]*Monitor)
	existingByID := make(map[uint]*Monitor)
	for i := range existingMonitors {
		existingByID[existingMonitors[i].ID] = &existingMonitors[i]
		if existingMonitors[i].ConfigHash != "" {
			existingByHash[existingMonitors[i].ConfigHash] = &existingMonitors[i]
		}
	}
	
	// If no YAML config found and database is empty, use defaults
	if len(yamlMonitors) == 0 {
		var count int64
		db.Model(&Monitor{}).Count(&count)
		if count == 0 {
			log.Println("[Config] No YAML config found and database is empty, seeding defaults...")
			defaultMonitors := []Monitor{
				{
					Name:         "Example.com",
					URL:          "https://example.com",
					Status:       "up",
					ResponseTime: 229,
					LastCheck:    "5s ago",
					CheckInterval: 60,
				},
				{
					Name:         "Google",
					URL:          "https://google.com",
					Status:       "up",
					ResponseTime: 2097,
					LastCheck:    "1s ago",
					IsThirdParty: true,
					CheckInterval: 60,
				},
			}
			for _, monitor := range defaultMonitors {
				if err := db.Create(&monitor).Error; err != nil {
					log.Printf("[Config] Failed to seed default monitor %s: %v", monitor.Name, err)
				} else {
					log.Printf("[Config] Created default monitor: %s (%s)", monitor.Name, monitor.URL)
					go checkService(&monitor)
				}
			}
		}
		return
	}
	
	log.Printf("[Config] Syncing %d monitors from YAML configuration", len(yamlMonitors))
	
	// Track which YAML hashes we've processed
	processedHashes := make(map[string]bool)
	
	// Process each monitor from YAML
	for i, monitor := range yamlMonitors {
		hash := yamlHashes[i]
		processedHashes[hash] = true
		
		// Check if a monitor with this hash already exists
		if _, exists := existingByHash[hash]; exists {
			// Monitor exists with same hash - no changes needed
			log.Printf("[Config] Monitor %s (%s) unchanged (hash: %s)", monitor.Name, monitor.URL, hash[:8])
			continue
		}
		
		// Check if a monitor with same name/URL exists
		var existingMonitor Monitor
		result := db.Where("name = ? AND url = ?", monitor.Name, monitor.URL).First(&existingMonitor)
		
		// Check if record exists (ignore "record not found" error as it's expected)
		if result.Error == nil {
			// Monitor with same name/URL exists
			if existingMonitor.ConfigHash == "" {
				// Monitor was created via UI/API (no ConfigHash) - skip YAML version to avoid duplicates
				log.Printf("[Config] Skipping monitor %s (%s) - already exists (created via UI/API)", monitor.Name, monitor.URL)
				continue
			}
			
			// Monitor exists and is YAML-managed - check if hash changed
			if existingMonitor.ConfigHash == hash {
				// Hash matches - no update needed (shouldn't reach here due to existingByHash check, but just in case)
				continue
			}
			
			// Monitor exists but hash changed - update it
			log.Printf("[Config] Updating monitor %s (%s) - config changed (old hash: %s, new hash: %s)",
				monitor.Name, monitor.URL, existingMonitor.ConfigHash[:8], hash[:8])
			
			// Preserve runtime data (status, uptime, response time, last check)
			monitor.ID = existingMonitor.ID
			monitor.Status = existingMonitor.Status
			monitor.Uptime = existingMonitor.Uptime
			monitor.ResponseTime = existingMonitor.ResponseTime
			monitor.LastCheck = existingMonitor.LastCheck
			monitor.CreatedAt = existingMonitor.CreatedAt
			
			if err := db.Save(&monitor).Error; err != nil {
				log.Printf("[Config] Failed to update monitor %s: %v", monitor.Name, err)
			} else {
				log.Printf("[Config] Updated monitor: %s (%s)", monitor.Name, monitor.URL)
				broadcastUpdate("monitor_update", monitor)
				// Re-check if not paused
				if !monitor.Paused {
					go checkService(&monitor)
				}
			}
		} else {
			// New monitor - create it
			if err := db.Create(&monitor).Error; err != nil {
				log.Printf("[Config] Failed to create monitor %s: %v", monitor.Name, err)
			} else {
				log.Printf("[Config] Created monitor: %s (%s) (hash: %s)", monitor.Name, monitor.URL, hash[:8])
				broadcastUpdate("monitor_added", monitor)
				// Immediately check the monitor
				go checkService(&monitor)
			}
		}
	}
	
	// Remove monitors that were in YAML but are no longer present
	// Only remove monitors that have a config_hash (were created from YAML)
	for hash, existing := range existingByHash {
		if !processedHashes[hash] {
			log.Printf("[Config] Removing monitor %s (%s) - no longer in YAML config (hash: %s)",
				existing.Name, existing.URL, hash[:8])
			
			monitorID := existing.ID
			if err := db.Delete(&Monitor{}, monitorID).Error; err != nil {
				log.Printf("[Config] Failed to delete monitor %s: %v", existing.Name, err)
			} else {
				log.Printf("[Config] Deleted monitor: %s (%s)", existing.Name, existing.URL)
				broadcastUpdate("monitor_deleted", map[string]interface{}{"id": monitorID})
			}
		}
	}
	
	broadcastStatsIfChanged()
	log.Println("[Config] ✅ YAML configuration synchronized")
}

