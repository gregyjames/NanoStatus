package main

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/go-co-op/gocron/v2"
	"github.com/rs/zerolog/log"
)

// Shared HTTP client with connection pooling for health checks
var httpClient *http.Client

// MonitorScheduler manages monitor jobs using gocron
type MonitorScheduler struct {
	scheduler gocron.Scheduler
	jobs      map[uint]gocron.Job // Track jobs by monitor ID
	mu        sync.RWMutex
}

var monitorScheduler *MonitorScheduler

func init() {
	// Create optimized HTTP transport with connection pooling
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	// Create shared HTTP client
	httpClient = &http.Client{
		Timeout:   10 * time.Second,
		Transport: transport,
	}

	// Initialize scheduler
	sched, err := gocron.NewScheduler()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create scheduler")
	}
	
	monitorScheduler = &MonitorScheduler{
		scheduler: sched,
		jobs:      make(map[uint]gocron.Job),
	}
	
	// Start the scheduler
	monitorScheduler.scheduler.Start()
	log.Info().Msg("[Scheduler] Started gocron scheduler")
}

// checkService performs a health check on a single monitor
// monitorID can be a monitor ID (uint) or a monitor pointer
func checkService(monitorIDOrPtr interface{}) {
	var monitor Monitor
	var monitorID uint
	
	// Handle both monitor ID and monitor pointer
	switch v := monitorIDOrPtr.(type) {
	case uint:
		monitorID = v
		if err := db.First(&monitor, monitorID).Error; err != nil {
			log.Error().Err(err).Uint("monitor_id", monitorID).Msg("Failed to load monitor for check")
			return
		}
	case *Monitor:
		monitorID = v.ID
		// Always read fresh from database to get latest CheckInterval and other fields
		if err := db.First(&monitor, monitorID).Error; err != nil {
			log.Error().Err(err).Uint("monitor_id", monitorID).Msg("Failed to load monitor for check")
			return
		}
	default:
		log.Error().Interface("type", v).Msg("checkService called with invalid type")
		return
	}
	
	// Skip if monitor is paused
	if monitor.Paused {
		log.Debug().Uint("monitor_id", monitorID).Msg("[Check] Skipping check for paused monitor")
		return
	}
	
	log.Debug().Uint("monitor_id", monitorID).Str("url", monitor.URL).Int("interval", monitor.CheckInterval).Msg("[Check] Starting health check")

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
			req.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
    		req.Header.Set("Pragma", "no-cache")
    		req.Header.Set("Expires", "0")
			//req.URL.RawQuery = fmt.Sprintf("_t=%d", time.Now().UnixNano())
			resp, err := httpClient.Do(req)
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
		ResponseTime: 0,
		CreatedAt:    time.Now(),
	}

	if status == "up" && responseTime > 0 {
		checkHistory.ResponseTime = responseTime
	}

	if err := db.Create(&checkHistory).Error; err != nil {
		log.Error().Err(err).Uint("monitor_id", monitor.ID).Msg("Failed to save check history")
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

	// Calculate uptime from last 24 hours of checks using a single query
	twentyFourHoursAgo := now.Add(-24 * time.Hour)
	var result struct {
		TotalCount int64
		UpCount    int64
	}
	
	uptimeErr := db.Model(&CheckHistory{}).
		Select("COUNT(*) as total_count, SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count").
		Where("monitor_id = ? AND created_at > ?", monitor.ID, twentyFourHoursAgo).
		Scan(&result).Error
	
	if uptimeErr == nil && result.TotalCount > 0 {
		monitor.Uptime = float64(result.UpCount) / float64(result.TotalCount) * 100
	} else {
		// If no checks in last 24h, use current status
		if status == "up" {
			monitor.Uptime = 100.0
		} else {
			monitor.Uptime = 0.0
		}
	}

	// Update monitor - only update check-related fields, not CheckInterval
	// This ensures we don't overwrite CheckInterval changes made via API
	db.Model(&monitor).Updates(map[string]interface{}{
		"status":        status,
		"response_time": responseTime,
		"last_check":    lastCheck,
		"uptime":        monitor.Uptime,
		"updated_at":    now,
	})
	
	// Reload monitor from database to get fresh data including CheckInterval for broadcast
	if err := db.First(&monitor, monitorID).Error; err != nil {
		log.Error().Err(err).Uint("monitor_id", monitorID).Msg("Failed to reload monitor after update")
		return
	}

	// Broadcast monitor update via SSE
	broadcastUpdate("monitor_update", monitor)
	
	// Schedule stats update (debounced to batch rapid updates)
	broadcastStatsIfChanged()
}

// checkAllServices checks all unpaused monitors
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

// addMonitorJob adds or updates a job for a monitor
func (ms *MonitorScheduler) addMonitorJob(monitor *Monitor) error {
	ms.mu.Lock()
	
	// Remove existing job if any - MUST do this first
	if job, exists := ms.jobs[monitor.ID]; exists {
		log.Info().Uint("monitor_id", monitor.ID).Msg("[Scheduler] Removing existing job before adding new one")
		if err := ms.scheduler.RemoveJob(job.ID()); err != nil {
			log.Warn().Err(err).Uint("monitor_id", monitor.ID).Msg("[Scheduler] Failed to remove existing job")
		}
		delete(ms.jobs, monitor.ID)
		// Give scheduler time to process removal
		ms.mu.Unlock()
		time.Sleep(100 * time.Millisecond)
		ms.mu.Lock()
	}
	
	// Skip paused monitors
	if monitor.Paused {
		log.Debug().Uint("monitor_id", monitor.ID).Msg("[Scheduler] Monitor is paused, not adding job")
		ms.mu.Unlock()
		return nil
	}
	
	interval := monitor.CheckInterval
	if interval <= 0 {
		interval = 60 // Default to 60 seconds
	}
	
	// Create job that runs checkService with monitor ID
	// Capture monitorID in closure
	monitorID := monitor.ID
	
	ms.mu.Unlock()
	
	// Create job outside lock to avoid blocking
	job, err := ms.scheduler.NewJob(
		gocron.DurationJob(time.Duration(interval)*time.Second),
		gocron.NewTask(func() {
			checkService(monitorID)
		}),
		gocron.WithName(fmt.Sprintf("monitor-%d", monitorID)),
	)
	
	if err != nil {
		log.Error().Err(err).Uint("monitor_id", monitor.ID).Int("interval", interval).Msg("[Scheduler] Failed to create job")
		return err
	}
	
	ms.mu.Lock()
	ms.jobs[monitor.ID] = job
	ms.mu.Unlock()
	
	log.Info().Uint("monitor_id", monitor.ID).
		Int("interval", interval).
		Int("db_check_interval", monitor.CheckInterval).
		Str("name", monitor.Name).
		Msg("[Scheduler] Added/updated job for monitor with interval")
	
	return nil
}

// removeMonitorJob removes a job for a monitor
func (ms *MonitorScheduler) removeMonitorJob(monitorID uint) {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	
	if job, exists := ms.jobs[monitorID]; exists {
		if err := ms.scheduler.RemoveJob(job.ID()); err != nil {
			log.Warn().Err(err).Uint("monitor_id", monitorID).Msg("[Scheduler] Failed to remove job")
		}
		delete(ms.jobs, monitorID)
		log.Info().Uint("monitor_id", monitorID).Msg("[Scheduler] Removed job for monitor")
	}
}

// refreshScheduler reloads all monitors and updates jobs
func (ms *MonitorScheduler) refreshScheduler() {
	var monitors []Monitor
	if err := db.Find(&monitors).Error; err != nil {
		log.Error().Err(err).Msg("[Scheduler] Failed to load monitors for refresh")
		return
	}
	
	log.Info().Int("monitor_count", len(monitors)).Msg("[Scheduler] Refreshing scheduler")
	
	ms.mu.Lock()
	activeIDs := make(map[uint]bool)
	ms.mu.Unlock()
	
	// Add/update jobs for all monitors - ALWAYS refresh each one
	for i := range monitors {
		monitor := &monitors[i]
		activeIDs[monitor.ID] = true
		
		// Always read fresh from database for each monitor to get latest CheckInterval
		var freshMonitor Monitor
		if err := db.First(&freshMonitor, monitor.ID).Error; err != nil {
			log.Error().Err(err).Uint("monitor_id", monitor.ID).Msg("[Scheduler] Failed to load monitor")
			continue
		}
		
		log.Info().Uint("monitor_id", freshMonitor.ID).
			Int("check_interval", freshMonitor.CheckInterval).
			Bool("paused", freshMonitor.Paused).
			Msg("[Scheduler] Processing monitor for job update")
		
		// ALWAYS call addMonitorJob - it will remove old job and add new one with fresh interval
		if err := ms.addMonitorJob(&freshMonitor); err != nil {
			log.Error().Err(err).Uint("monitor_id", freshMonitor.ID).Msg("[Scheduler] Failed to add job")
		}
	}
	
	// Remove jobs for monitors that no longer exist
	ms.mu.Lock()
	for monitorID := range ms.jobs {
		if !activeIDs[monitorID] {
			ms.mu.Unlock()
			ms.removeMonitorJob(monitorID)
			ms.mu.Lock()
		}
	}
	ms.mu.Unlock()
}

// startChecker starts the background service checker
func startChecker() {
	// Check immediately on startup
	checkAllServices()

	// Refresh scheduler periodically to pick up new/updated monitors
	go func() {
		// Initial refresh
		monitorScheduler.refreshScheduler()
		
		// Refresh every 30 seconds to pick up changes
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		
		for range ticker.C {
			monitorScheduler.refreshScheduler()
		}
	}()
}
