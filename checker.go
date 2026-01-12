package main

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// Shared HTTP client with connection pooling for health checks
var httpClient *http.Client

// MonitorScheduler manages per-monitor tickers for efficient scheduling
type MonitorScheduler struct {
	tickers map[uint]*time.Ticker
	stopCh  map[uint]chan struct{}
	mu      sync.RWMutex
}

var monitorScheduler = &MonitorScheduler{
	tickers: make(map[uint]*time.Ticker),
	stopCh:  make(map[uint]chan struct{}),
}

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
}

// checkService performs a health check on a single monitor
func checkService(monitor *Monitor) {

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

	// Update monitor
	monitor.Status = status
	monitor.ResponseTime = responseTime
	monitor.LastCheck = lastCheck
	monitor.UpdatedAt = now
	db.Save(monitor)

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

// stopMonitorTicker stops the ticker for a specific monitor
func (ms *MonitorScheduler) stopMonitorTicker(monitorID uint) {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	
	if ticker, exists := ms.tickers[monitorID]; exists {
		ticker.Stop()
		delete(ms.tickers, monitorID)
	}
	
	if stopCh, exists := ms.stopCh[monitorID]; exists {
		close(stopCh)
		delete(ms.stopCh, monitorID)
	}
}

// startMonitorTicker starts a ticker for a specific monitor
func (ms *MonitorScheduler) startMonitorTicker(monitor *Monitor) {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	
	// Stop existing ticker if any
	if ticker, exists := ms.tickers[monitor.ID]; exists {
		ticker.Stop()
	}
	if stopCh, exists := ms.stopCh[monitor.ID]; exists {
		close(stopCh)
	}
	
	// Skip paused monitors
	if monitor.Paused {
		return
	}
	
	interval := monitor.CheckInterval
	if interval <= 0 {
		interval = 60 // Default to 60 seconds
	}
	
	// Create ticker and stop channel
	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	stopCh := make(chan struct{})
	
	ms.tickers[monitor.ID] = ticker
	ms.stopCh[monitor.ID] = stopCh
	
	// Start goroutine for this monitor
	go func(m *Monitor, t *time.Ticker, stop chan struct{}) {
		// Check immediately
		go checkService(m)
		
		for {
			select {
			case <-t.C:
				go checkService(m)
			case <-stop:
				return
			}
		}
	}(monitor, ticker, stopCh)
}

// refreshScheduler reloads all monitors and updates tickers
func (ms *MonitorScheduler) refreshScheduler() {
	var monitors []Monitor
	db.Find(&monitors)
	
	ms.mu.Lock()
	activeIDs := make(map[uint]bool)
	
	// Start/update tickers for all active monitors
	for i := range monitors {
		monitor := &monitors[i]
		activeIDs[monitor.ID] = true
		
		// Check if ticker exists
		if _, exists := ms.tickers[monitor.ID]; exists {
			// If paused, stop the ticker; otherwise keep it running
			// (interval changes will be handled on next refresh)
			if monitor.Paused {
				ms.mu.Unlock()
				ms.stopMonitorTicker(monitor.ID)
				ms.mu.Lock()
			}
		} else {
			// New monitor or was paused - start ticker if not paused
			if !monitor.Paused {
				ms.mu.Unlock()
				ms.startMonitorTicker(monitor)
				ms.mu.Lock()
			}
		}
	}
	
	// Stop tickers for monitors that no longer exist
	for monitorID := range ms.tickers {
		if !activeIDs[monitorID] {
			ms.mu.Unlock()
			ms.stopMonitorTicker(monitorID)
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

