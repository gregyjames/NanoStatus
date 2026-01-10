package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"
)

// getResponseTimeData retrieves response time history for a monitor within a time range
func getResponseTimeData(monitorID string, timeRange string) []ResponseTimeData {
	id, err := strconv.ParseUint(monitorID, 10, 32)
	if err != nil {
		return []ResponseTimeData{}
	}

	// Calculate time cutoff based on range
	var cutoffTime time.Time
	now := time.Now()
	
	switch timeRange {
	case "1h":
		cutoffTime = now.Add(-1 * time.Hour)
	case "12h":
		cutoffTime = now.Add(-12 * time.Hour)
	case "1w":
		cutoffTime = now.Add(-7 * 24 * time.Hour)
	case "1y":
		cutoffTime = now.Add(-365 * 24 * time.Hour)
	default:
		// Default to 24 hours
		cutoffTime = now.Add(-24 * time.Hour)
	}

	// Get checks within time range, ordered by creation time
	var checks []CheckHistory
	query := db.Where("monitor_id = ? AND created_at > ?", id, cutoffTime).
		Order("created_at ASC")
	
	// Limit results based on time range to avoid too much data
	switch timeRange {
	case "1h":
		query = query.Limit(60) // Max 60 points for 1 hour
	case "12h":
		query = query.Limit(144) // Max 144 points for 12 hours
	case "24h":
		query = query.Limit(288) // Max 288 points for 24 hours
	case "1w":
		query = query.Limit(168) // Max 168 points for 1 week
	case "1y":
		query = query.Limit(365) // Max 365 points for 1 year
	default:
		query = query.Limit(50)
	}
	
	query.Find(&checks)

	// If no data, return empty array
	if len(checks) == 0 {
		return []ResponseTimeData{}
	}

	// Convert to response time data format
	// Send ISO 8601 timestamps and let the frontend format them in the user's timezone
	data := make([]ResponseTimeData, len(checks))
	for i, check := range checks {
		// Send ISO 8601 timestamp (UTC) - frontend will format in user's timezone
		isoTimestamp := check.CreatedAt.Format(time.RFC3339)
		
		// Also provide a fallback formatted string (UTC) for backwards compatibility
		var timeStr string
		switch timeRange {
		case "1h", "12h", "24h":
			timeStr = check.CreatedAt.Format("03:04 PM")
		case "1w":
			timeStr = check.CreatedAt.Format("Mon 03:04 PM")
		case "1y":
			timeStr = check.CreatedAt.Format("Jan 2")
		default:
			timeStr = check.CreatedAt.Format("03:04 PM")
		}
		
		data[i] = ResponseTimeData{
			Time:         timeStr,      // Fallback (will be overridden by frontend)
			Timestamp:    isoTimestamp, // ISO 8601 timestamp for client-side formatting
			ResponseTime: float64(check.ResponseTime),
		}
	}

	return data
}

// apiMonitors handles GET requests to list all monitors
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

// apiCreateMonitor handles POST requests to create a new monitor
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
	
	// Broadcast new monitor via SSE
	broadcastUpdate("monitor_added", monitor)
	
	// Schedule stats update (debounced)
	broadcastStatsIfChanged()

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(monitor)
}

// apiStats handles GET requests to retrieve overall statistics
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

// apiResponseTime handles GET requests to retrieve response time history
func apiResponseTime(w http.ResponseWriter, r *http.Request) {
	monitorID := r.URL.Query().Get("id")
	timeRange := r.URL.Query().Get("range")
	if monitorID == "" {
		monitorID = "1"
	}
	if timeRange == "" {
		timeRange = "24h" // Default to 24 hours
	}
	log.Printf("[API] %s %s?id=%s&range=%s", r.Method, r.URL.Path, monitorID, timeRange)
	
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != http.MethodGet {
		log.Printf("[API] ERROR %s /api/response-time: Method not allowed", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	data := getResponseTimeData(monitorID, timeRange)
	log.Printf("[API] GET /api/response-time?id=%s&range=%s: returned %d data points", monitorID, timeRange, len(data))
	json.NewEncoder(w).Encode(data)
}

// apiSSE handles Server-Sent Events connections
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

// apiMonitor handles GET, PUT, and DELETE requests for individual monitors
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
			
			// Broadcast update via SSE
			broadcastUpdate("monitor_update", monitor)
			broadcastStatsIfChanged()
			
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
		
		// Broadcast update via SSE
		broadcastUpdate("monitor_update", monitor)
		broadcastStatsIfChanged()
		
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
		
		// Schedule stats update (debounced)
		broadcastStatsIfChanged()
		
		w.WriteHeader(http.StatusNoContent)
		return
	}

	log.Printf("[API] ERROR %s /api/monitor: Method not allowed", r.Method)
	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

