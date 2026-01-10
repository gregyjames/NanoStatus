package main

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// checkService performs a health check on a single monitor
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
			req.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
    		req.Header.Set("Pragma", "no-cache")
    		req.Header.Set("Expires", "0")
			//req.URL.RawQuery = fmt.Sprintf("_t=%d", time.Now().UnixNano())
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

// startChecker starts the background service checker
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

