package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
)

//go:embed dist
var staticFiles embed.FS

var db *gorm.DB

// SSE broadcaster for real-time updates
type SSEClient struct {
	ID   string
	Send chan []byte
}

type SSEBroadcaster struct {
	clients   map[string]*SSEClient
	mu        sync.RWMutex
	broadcast chan []byte
}

var sseBroadcaster = &SSEBroadcaster{
	clients:   make(map[string]*SSEClient),
	broadcast: make(chan []byte, 256),
}

func (b *SSEBroadcaster) addClient(id string) *SSEClient {
	b.mu.Lock()
	defer b.mu.Unlock()
	client := &SSEClient{
		ID:   id,
		Send: make(chan []byte, 256),
	}
	b.clients[id] = client
	log.Printf("[SSE] Client connected: %s (total: %d)", id, len(b.clients))
	return client
}

func (b *SSEBroadcaster) removeClient(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if client, ok := b.clients[id]; ok {
		close(client.Send)
		delete(b.clients, id)
		log.Printf("[SSE] Client disconnected: %s (total: %d)", id, len(b.clients))
	}
}

func (b *SSEBroadcaster) broadcastMessage(message []byte) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	
	clientCount := len(b.clients)
	if clientCount == 0 {
		log.Printf("[SSE] No clients connected, dropping message (%d bytes)", len(message))
		return
	}
	
	sentCount := 0
	droppedCount := 0
	for id, client := range b.clients {
		select {
		case client.Send <- message:
			sentCount++
		default:
			droppedCount++
			log.Printf("[SSE] Client %s channel full, dropping message", id)
		}
	}
	
	log.Printf("[SSE] Broadcast: sent to %d/%d clients (%d bytes, %d dropped)", 
		sentCount, clientCount, len(message), droppedCount)
}

func broadcastUpdate(updateType string, data interface{}) {
	update := map[string]interface{}{
		"type": updateType,
		"data": data,
	}
	jsonData, err := json.Marshal(update)
	if err != nil {
		log.Printf("[SSE] ERROR: Failed to marshal %s update: %v", updateType, err)
		return
	}
	
	log.Printf("[SSE] Broadcasting %s update (%d bytes)", updateType, len(jsonData))
	go sseBroadcaster.broadcastMessage(jsonData)
}

type Monitor struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"not null" json:"name"`
	URL          string    `gorm:"not null" json:"url"`
	Uptime       float64   `gorm:"default:0" json:"uptime"`
	Status       string    `gorm:"default:unknown" json:"status"`
	ResponseTime int       `gorm:"default:0" json:"responseTime"`
	LastCheck    string    `gorm:"default:never" json:"lastCheck"`
	IsThirdParty bool      `gorm:"default:false" json:"isThirdParty,omitempty"`
	Icon         string    `json:"icon,omitempty"`
	CheckInterval int      `gorm:"default:60" json:"checkInterval"` // Interval in seconds
	Paused       bool      `gorm:"default:false" json:"paused"` // Whether monitoring is paused
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type CreateMonitorRequest struct {
	Name         string `json:"name"`
	URL          string `json:"url"`
	IsThirdParty bool   `json:"isThirdParty,omitempty"`
	Icon         string `json:"icon,omitempty"`
	CheckInterval int   `json:"checkInterval,omitempty"` // Interval in seconds (default: 60)
}

type StatsResponse struct {
	OverallUptime   float64 `json:"overallUptime"`
	ServicesUp      int     `json:"servicesUp"`
	ServicesDown    int     `json:"servicesDown"`
	AvgResponseTime int     `json:"avgResponseTime"`
}

type CheckHistory struct {
	ID           uint      `gorm:"primaryKey"`
	MonitorID    uint      `gorm:"not null;index"`
	Status       string    `gorm:"not null"`
	ResponseTime int       `gorm:"default:0"`
	CreatedAt    time.Time `gorm:"index"`
}

type ResponseTimeData struct {
	Time         string  `json:"time"`
	ResponseTime float64 `json:"responseTime"`
}

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
	
	// Configure connection pool for concurrent access
	sqlDB.SetMaxOpenConns(1) // SQLite works best with a single connection
	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetConnMaxLifetime(time.Hour)
	
	// Use GORM with the existing database connection
	// This ensures we use modernc.org/sqlite instead of the CGO driver
	db, err = gorm.Open(sqlite.Dialector{Conn: sqlDB}, &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto migrate
	err = db.AutoMigrate(&Monitor{}, &CheckHistory{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Seed initial data if database is empty
	var count int64
	db.Model(&Monitor{}).Count(&count)
	if count == 0 {
		seedData()
	}
}

func seedData() {
	monitors := []Monitor{
		{
			Name:         "Example.com",
			URL:          "https://example.com",
			Uptime:       100,
			Status:       "up",
			ResponseTime: 89,
			LastCheck:    "5s ago",
			CheckInterval: 60,
		},
		{
			Name:         "Google",
			URL:          "https://google.com",
			Uptime:       100,
			Status:       "up",
			ResponseTime: 67,
			LastCheck:    "1s ago",
			IsThirdParty: true,
			CheckInterval: 60,
		},
	}

	for _, monitor := range monitors {
		db.Create(&monitor)
	}
	log.Println("✅ Seeded initial data")
}

func getStats() StatsResponse {
	var monitors []Monitor
	db.Find(&monitors)

	upCount := 0
	downCount := 0
	totalUptime := 0.0
	unpausedCount := 0

	for _, monitor := range monitors {
		// Skip paused monitors from all calculations
		if monitor.Paused {
			continue
		}
		
		unpausedCount++
		
		if monitor.Status == "up" {
			upCount++
		} else {
			downCount++
		}
		
		// Sum up all monitors' uptime percentages (calculated from 24h history)
		totalUptime += monitor.Uptime
	}

	// Calculate average response time from all check history in last 24 hours
	// This gives a more accurate average across all checks, not just the last check per monitor
	var avgResponseTime int
	twentyFourHoursAgo := time.Now().Add(-24 * time.Hour)
	
	// Use raw SQL query to get average response time (GORM uses snake_case for column names)
	var avgResult sql.NullFloat64
	var countResult int64
	
	// Get count first
	db.Model(&CheckHistory{}).
		Where("created_at > ? AND response_time > 0", twentyFourHoursAgo).
		Count(&countResult)
	
	if countResult > 0 {
		// Use raw SQL to ensure correct column name
		err := db.Raw(`
			SELECT AVG(response_time) as avg_response_time 
			FROM check_histories 
			WHERE created_at > ? AND response_time > 0
		`, twentyFourHoursAgo).Row().Scan(&avgResult)
		
		if err == nil && avgResult.Valid {
			avgResponseTime = int(avgResult.Float64)
			log.Printf("[Stats] Calculated avg response time from %d checks: %dms", countResult, avgResponseTime)
		} else {
			log.Printf("[Stats] Error calculating avg response time: %v (count: %d)", err, countResult)
		}
	} else {
		log.Printf("[Stats] No check history found in last 24 hours")
	}
	
	// Fallback: calculate from current monitor response times if no history or query failed
	if countResult == 0 || avgResponseTime == 0 {
		totalResponseTime := 0
		responseCount := 0
		for _, monitor := range monitors {
			// Skip paused monitors
			if monitor.Paused {
				continue
			}
			if monitor.ResponseTime > 0 {
				totalResponseTime += monitor.ResponseTime
				responseCount++
			}
		}
		if responseCount > 0 {
			avgResponseTime = totalResponseTime / responseCount
			log.Printf("[Stats] Using fallback: avg response time from %d monitors: %dms", responseCount, avgResponseTime)
		}
	}

	// Calculate overall uptime as average of all unpaused monitors' historical uptime percentages
	overallUptime := 0.0
	if unpausedCount > 0 {
		overallUptime = totalUptime / float64(unpausedCount)
	}

	return StatsResponse{
		OverallUptime:   overallUptime,
		ServicesUp:      upCount,
		ServicesDown:    downCount,
		AvgResponseTime: avgResponseTime,
	}
}

func checkService(monitor *Monitor) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	start := time.Now()
	var status string
	var responseTime int

	// Parse URL and handle different protocols
	serviceURL := monitor.URL
	if !strings.HasPrefix(serviceURL, "http://") && !strings.HasPrefix(serviceURL, "https://") {
		if strings.HasPrefix(serviceURL, "ping://") {
			// For ping, we'll just mark as up for now (would need ping library for real ping)
			status = "up"
			responseTime = 10
		} else {
			// Default to https
			serviceURL = "https://" + serviceURL
		}
	}

	// Validate URL
	parsedURL, err := url.Parse(serviceURL)
	if err != nil || parsedURL.Host == "" {
		status = "down"
		responseTime = 0
	} else {
		// Make HTTP request
		req, err := http.NewRequest("GET", serviceURL, nil)
		if err != nil {
			status = "down"
			responseTime = 0
		} else {
			req.Header.Set("User-Agent", "NanoStatus/1.0")
			resp, err := client.Do(req)
			elapsed := time.Since(start)
			responseTime = int(elapsed.Milliseconds())

			if err != nil {
				status = "down"
				responseTime = 0
			} else {
				resp.Body.Close()
				if resp.StatusCode >= 200 && resp.StatusCode < 400 {
					status = "up"
				} else {
					status = "down"
				}
			}
		}
	}

	// Save check history to database (persists response time data)
	checkHistory := CheckHistory{
		MonitorID:    monitor.ID,
		Status:       status,
		ResponseTime: responseTime,
		CreatedAt:    time.Now(),
	}
	if err := db.Create(&checkHistory).Error; err != nil {
		log.Printf("Failed to save check history for monitor %d: %v", monitor.ID, err)
	}

	// Update monitor with latest check
	now := time.Now()
	lastCheck := "just now"
	if now.Sub(monitor.UpdatedAt) > time.Minute {
		minutes := int(now.Sub(monitor.UpdatedAt).Minutes())
		if minutes < 60 {
			lastCheck = fmt.Sprintf("%dm ago", minutes)
		} else {
			hours := minutes / 60
			lastCheck = fmt.Sprintf("%dh ago", hours)
		}
	}

	// Calculate uptime from last 24 hours of checks
	var upCount, totalCount int64
	twentyFourHoursAgo := now.Add(-24 * time.Hour)
	db.Model(&CheckHistory{}).
		Where("monitor_id = ? AND created_at > ?", monitor.ID, twentyFourHoursAgo).
		Count(&totalCount)
	
	if totalCount > 0 {
		db.Model(&CheckHistory{}).
			Where("monitor_id = ? AND created_at > ? AND status = ?", monitor.ID, twentyFourHoursAgo, "up").
			Count(&upCount)
		monitor.Uptime = float64(upCount) / float64(totalCount) * 100
	} else {
		// If no checks in last 24h, use current status
		if status == "up" {
			monitor.Uptime = 100.0
		} else {
			monitor.Uptime = 0.0
		}
	}

	// Update monitor
	monitor.Status = status
	monitor.ResponseTime = responseTime
	monitor.LastCheck = lastCheck
	monitor.UpdatedAt = now
	db.Save(monitor)

	// Broadcast update via SSE
	broadcastUpdate("monitor_update", monitor)
	
	// Also broadcast stats update
	stats := getStats()
	broadcastUpdate("stats_update", stats)
}

func checkAllServices() {
	var monitors []Monitor
	db.Find(&monitors)

	for i := range monitors {
		// Skip paused monitors
		if monitors[i].Paused {
			continue
		}
		
		checkService(&monitors[i])
		// Small delay between checks to avoid overwhelming servers
		time.Sleep(500 * time.Millisecond)
	}
}

func startChecker() {
	// Check immediately on startup
	checkAllServices()

	// Start individual checkers for each monitor based on their intervals
	go func() {
		for {
			var monitors []Monitor
			db.Find(&monitors)

			for i := range monitors {
				monitor := &monitors[i]
				
				// Skip paused monitors
				if monitor.Paused {
					continue
				}
				
				interval := monitor.CheckInterval
				if interval <= 0 {
					interval = 60 // Default to 60 seconds
				}

				// Check if it's time to check this monitor
				timeSinceLastCheck := time.Since(monitor.UpdatedAt)
				intervalDuration := time.Duration(interval) * time.Second

				if timeSinceLastCheck >= intervalDuration {
					go checkService(monitor)
					// Small delay between concurrent checks
					time.Sleep(100 * time.Millisecond)
				}
			}

			// Check every 10 seconds to see if any monitor needs checking
			time.Sleep(10 * time.Second)
		}
	}()
}

func getResponseTimeData(monitorID string) []ResponseTimeData {
	id, err := strconv.ParseUint(monitorID, 10, 32)
	if err != nil {
		return []ResponseTimeData{}
	}

	// Get last 50 checks from database, ordered by creation time
	var checks []CheckHistory
	db.Where("monitor_id = ?", id).
		Order("created_at ASC").
		Limit(50).
		Find(&checks)

	// If no data, return empty array
	if len(checks) == 0 {
		return []ResponseTimeData{}
	}

	// Convert to response time data format
	data := make([]ResponseTimeData, len(checks))
	for i, check := range checks {
		data[i] = ResponseTimeData{
			Time:         check.CreatedAt.Format("03:04 PM"),
			ResponseTime: float64(check.ResponseTime),
		}
	}

	return data
}

func apiMonitors(w http.ResponseWriter, r *http.Request) {
	log.Printf("[API] %s %s", r.Method, r.URL.Path)
	
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodGet {
		var monitors []Monitor
		if err := db.Find(&monitors).Error; err != nil {
			log.Printf("[API] ERROR GET /api/monitors: %v", err)
			http.Error(w, "Failed to fetch monitors", http.StatusInternalServerError)
			return
		}
		log.Printf("[API] GET /api/monitors: returned %d monitors", len(monitors))
		json.NewEncoder(w).Encode(monitors)
		return
	}

	log.Printf("[API] ERROR %s /api/monitors: Method not allowed", r.Method)
	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func apiCreateMonitor(w http.ResponseWriter, r *http.Request) {
	log.Printf("[API] %s %s", r.Method, r.URL.Path)
	
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		log.Printf("[API] OPTIONS /api/monitors/create: CORS preflight")
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		log.Printf("[API] ERROR %s /api/monitors/create: Method not allowed", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateMonitorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[API] ERROR POST /api/monitors/create: Invalid request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.URL == "" {
		log.Printf("[API] ERROR POST /api/monitors/create: Missing required fields (name=%q, url=%q)", req.Name, req.URL)
		http.Error(w, "Name and URL are required", http.StatusBadRequest)
		return
	}

	// Set default check interval to 60 seconds if not provided
	checkInterval := req.CheckInterval
	if checkInterval <= 0 {
		checkInterval = 60
	}

	monitor := Monitor{
		Name:         req.Name,
		URL:          req.URL,
		IsThirdParty: req.IsThirdParty,
		Icon:         req.Icon,
		Status:       "unknown",
		Uptime:       0,
		ResponseTime: 0,
		LastCheck:    "never",
		CheckInterval: checkInterval,
	}

	if err := db.Create(&monitor).Error; err != nil {
		log.Printf("[API] ERROR POST /api/monitors/create: Failed to create monitor: %v", err)
		http.Error(w, "Failed to create monitor", http.StatusInternalServerError)
		return
	}

	log.Printf("[API] POST /api/monitors/create: Created monitor ID=%d, name=%q, url=%q, checkInterval=%ds", monitor.ID, monitor.Name, monitor.URL, monitor.CheckInterval)

	// Immediately check the new monitor
	go checkService(&monitor)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(monitor)
}

func apiStats(w http.ResponseWriter, r *http.Request) {
	log.Printf("[API] %s %s", r.Method, r.URL.Path)
	
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != http.MethodGet {
		log.Printf("[API] ERROR %s /api/stats: Method not allowed", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats := getStats()
	log.Printf("[API] GET /api/stats: overallUptime=%.2f%%, servicesUp=%d, servicesDown=%d, avgResponseTime=%dms", 
		stats.OverallUptime, stats.ServicesUp, stats.ServicesDown, stats.AvgResponseTime)
	json.NewEncoder(w).Encode(stats)
}

func apiResponseTime(w http.ResponseWriter, r *http.Request) {
	monitorID := r.URL.Query().Get("id")
	if monitorID == "" {
		monitorID = "1"
	}
	log.Printf("[API] %s %s?id=%s", r.Method, r.URL.Path, monitorID)
	
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != http.MethodGet {
		log.Printf("[API] ERROR %s /api/response-time: Method not allowed", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	data := getResponseTimeData(monitorID)
	log.Printf("[API] GET /api/response-time?id=%s: returned %d data points", monitorID, len(data))
	json.NewEncoder(w).Encode(data)
}

func apiSSE(w http.ResponseWriter, r *http.Request) {
	log.Printf("[SSE] New connection request from %s (User-Agent: %s)", r.RemoteAddr, r.UserAgent())
	
	// Set headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Cache-Control")

	// Create client
	clientID := fmt.Sprintf("%s-%d", r.RemoteAddr, time.Now().UnixNano())
	client := sseBroadcaster.addClient(clientID)
	defer func() {
		sseBroadcaster.removeClient(clientID)
		log.Printf("[SSE] Cleanup completed for client %s", clientID)
	}()

	// Send initial connection message
	connectMsg := `{"type":"connected"}`
	fmt.Fprintf(w, "data: %s\n\n", connectMsg)
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
		log.Printf("[SSE] Sent connection confirmation to client %s", clientID)
	} else {
		log.Printf("[SSE] WARNING: ResponseWriter does not support flushing for client %s", clientID)
	}

	// Keep connection alive and send updates
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	messageCount := 0
	keepaliveCount := 0
	startTime := time.Now()

	for {
		select {
		case message := <-client.Send:
			messageCount++
			fmt.Fprintf(w, "data: %s\n\n", string(message))
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
				log.Printf("[SSE] Sent message #%d to client %s (%d bytes)", 
					messageCount, clientID, len(message))
			} else {
				log.Printf("[SSE] ERROR: Cannot flush message to client %s", clientID)
			}
		case <-ticker.C:
			// Send keepalive
			keepaliveCount++
			fmt.Fprintf(w, ": keepalive\n\n")
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
				log.Printf("[SSE] Sent keepalive #%d to client %s", keepaliveCount, clientID)
			}
		case <-r.Context().Done():
			duration := time.Since(startTime)
			log.Printf("[SSE] Client %s disconnected after %v (sent %d messages, %d keepalives)", 
				clientID, duration, messageCount, keepaliveCount)
			return
		}
	}
}

func apiMonitor(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	log.Printf("[API] %s %s?id=%s", r.Method, r.URL.Path, id)
	
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		log.Printf("[API] OPTIONS /api/monitor: CORS preflight")
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		if id == "" {
			log.Printf("[API] ERROR GET /api/monitor: Missing id parameter")
			http.Error(w, "Missing id parameter", http.StatusBadRequest)
			return
		}

		var monitor Monitor
		monitorID, err := strconv.ParseUint(id, 10, 32)
		if err != nil {
			log.Printf("[API] ERROR GET /api/monitor?id=%s: Invalid id parameter: %v", id, err)
			http.Error(w, "Invalid id parameter", http.StatusBadRequest)
			return
		}

		if err := db.First(&monitor, monitorID).Error; err != nil {
			log.Printf("[API] ERROR GET /api/monitor?id=%s: Monitor not found", id)
			http.Error(w, "Monitor not found", http.StatusNotFound)
			return
		}

		log.Printf("[API] GET /api/monitor?id=%s: returned monitor name=%q", id, monitor.Name)
		json.NewEncoder(w).Encode(monitor)
		return
	}

	if r.Method == http.MethodPut {
		w.Header().Set("Content-Type", "application/json")
		if id == "" {
			log.Printf("[API] ERROR PUT /api/monitor: Missing id parameter")
			http.Error(w, "Missing id parameter", http.StatusBadRequest)
			return
		}

		monitorID, err := strconv.ParseUint(id, 10, 32)
		if err != nil {
			log.Printf("[API] ERROR PUT /api/monitor?id=%s: Invalid id parameter: %v", id, err)
			http.Error(w, "Invalid id parameter", http.StatusBadRequest)
			return
		}

		var monitor Monitor
		if err := db.First(&monitor, monitorID).Error; err != nil {
			log.Printf("[API] ERROR PUT /api/monitor?id=%s: Monitor not found", id)
			http.Error(w, "Monitor not found", http.StatusNotFound)
			return
		}

		// Read body once
		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			log.Printf("[API] ERROR PUT /api/monitor?id=%s: Failed to read body: %v", id, err)
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}

		// Check if this is a pause/unpause request (has only "paused" field)
		var pauseReq struct {
			Paused *bool `json:"paused"`
		}
		if err := json.Unmarshal(bodyBytes, &pauseReq); err == nil && pauseReq.Paused != nil {
			// This is a pause/unpause request
			monitor.Paused = *pauseReq.Paused
			if err := db.Save(&monitor).Error; err != nil {
				log.Printf("[API] ERROR PUT /api/monitor?id=%s: Failed to update paused state: %v", id, err)
				http.Error(w, "Failed to update paused state", http.StatusInternalServerError)
				return
			}
			log.Printf("[API] PUT /api/monitor?id=%s: Updated paused state to %v", id, monitor.Paused)
			json.NewEncoder(w).Encode(monitor)
			return
		}

		// Regular update request
		var req CreateMonitorRequest
		if err := json.Unmarshal(bodyBytes, &req); err != nil {
			log.Printf("[API] ERROR PUT /api/monitor?id=%s: Invalid request body: %v", id, err)
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Name == "" || req.URL == "" {
			log.Printf("[API] ERROR PUT /api/monitor?id=%s: Missing required fields", id)
			http.Error(w, "Name and URL are required", http.StatusBadRequest)
			return
		}

		// Set default check interval to 60 seconds if not provided
		checkInterval := req.CheckInterval
		if checkInterval <= 0 {
			checkInterval = 60
		}

		// Update monitor fields
		monitor.Name = req.Name
		monitor.URL = req.URL
		monitor.IsThirdParty = req.IsThirdParty
		monitor.Icon = req.Icon
		monitor.CheckInterval = checkInterval

		if err := db.Save(&monitor).Error; err != nil {
			log.Printf("[API] ERROR PUT /api/monitor?id=%s: Failed to update monitor: %v", id, err)
			http.Error(w, "Failed to update monitor", http.StatusInternalServerError)
			return
		}

		log.Printf("[API] PUT /api/monitor?id=%s: Updated monitor name=%q, url=%q, checkInterval=%ds", id, monitor.Name, monitor.URL, monitor.CheckInterval)
		json.NewEncoder(w).Encode(monitor)
		return
	}

	if r.Method == http.MethodDelete {
		if id == "" {
			log.Printf("[API] ERROR DELETE /api/monitor: Missing id parameter")
			http.Error(w, "Missing id parameter", http.StatusBadRequest)
			return
		}

		monitorID, err := strconv.ParseUint(id, 10, 32)
		if err != nil {
			log.Printf("[API] ERROR DELETE /api/monitor?id=%s: Invalid id parameter: %v", id, err)
			http.Error(w, "Invalid id parameter", http.StatusBadRequest)
			return
		}

		// Check if monitor exists first
		var monitor Monitor
		if err := db.First(&monitor, monitorID).Error; err != nil {
			log.Printf("[API] ERROR DELETE /api/monitor?id=%s: Monitor not found", id)
			http.Error(w, "Monitor not found", http.StatusNotFound)
			return
		}

		if err := db.Delete(&Monitor{}, monitorID).Error; err != nil {
			log.Printf("[API] ERROR DELETE /api/monitor?id=%s: Failed to delete: %v", id, err)
			http.Error(w, "Failed to delete monitor", http.StatusInternalServerError)
			return
		}

		log.Printf("[API] DELETE /api/monitor?id=%s: Successfully deleted monitor name=%q", id, monitor.Name)
		
		// Broadcast deletion via SSE
		broadcastUpdate("monitor_deleted", map[string]interface{}{"id": monitorID})
		
		// Broadcast stats update
		stats := getStats()
		broadcastUpdate("stats_update", stats)
		
		w.WriteHeader(http.StatusNoContent)
		return
	}

	log.Printf("[API] ERROR %s /api/monitor: Method not allowed", r.Method)
	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func main() {
	// Initialize database
	initDB()

	// Start background checker
	startChecker()

	// API routes
	http.HandleFunc("/api/monitors", apiMonitors)
	http.HandleFunc("/api/monitors/create", apiCreateMonitor)
	http.HandleFunc("/api/stats", apiStats)
	http.HandleFunc("/api/response-time", apiResponseTime)
	http.HandleFunc("/api/monitor", apiMonitor)
	http.HandleFunc("/api/events", apiSSE)

	// Serve static files
	staticFS, err := fs.Sub(staticFiles, "dist")
	if err != nil {
		log.Fatal("Failed to create sub filesystem:", err)
	}

	fileServer := http.FileServer(http.FS(staticFS))

	// Handle SPA routing - serve index.html for all non-API routes
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Don't serve index.html for API routes
		if strings.HasPrefix(r.URL.Path, "/api") {
			http.NotFound(w, r)
			return
		}

		// Try to serve the requested file
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		file, err := staticFS.Open(path)
		if err == nil {
			file.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// If file doesn't exist, serve index.html for SPA routing
		index, err := staticFS.Open("index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer index.Close()

		// Read the file content
		content, err := io.ReadAll(index)
		if err != nil {
			http.Error(w, "Error reading index.html", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/html")
		w.Write(content)
	})

	port := ":8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = ":" + envPort
	}

	log.Printf("🚀 Server starting on port %s", port)
	log.Println("📊 API endpoints:")
	log.Println("   GET /api/monitors - List all monitors")
	log.Println("   POST /api/monitors/create - Create a new monitor")
	log.Println("   GET /api/stats - Get overall statistics")
	log.Println("   GET /api/response-time?id=<id> - Get response time data")
	log.Println("   GET /api/monitor?id=<id> - Get specific monitor")
	log.Println("   DELETE /api/monitor?id=<id> - Delete a monitor")
	log.Fatal(http.ListenAndServe(port, nil))
}
