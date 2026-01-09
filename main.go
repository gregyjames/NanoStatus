package main

import (
	"embed"
	"encoding/json"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

//go:embed dist
var staticFiles embed.FS

type Monitor struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	URL         string    `json:"url"`
	Uptime      float64   `json:"uptime"`
	Status      string    `json:"status"`
	ResponseTime int      `json:"responseTime"`
	LastCheck   string    `json:"lastCheck"`
	IsThirdParty bool     `json:"isThirdParty,omitempty"`
	Icon        string    `json:"icon,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type StatsResponse struct {
	OverallUptime   float64 `json:"overallUptime"`
	ServicesUp      int     `json:"servicesUp"`
	ServicesDown    int     `json:"servicesDown"`
	AvgResponseTime int     `json:"avgResponseTime"`
}

type ResponseTimeData struct {
	Time         string  `json:"time"`
	ResponseTime float64 `json:"responseTime"`
}

var monitors = []Monitor{
	{
		ID:          "1",
		Name:        "Check Port",
		URL:         "https://checkport.example.com",
		Uptime:      100,
		Status:      "up",
		ResponseTime: 145,
		LastCheck:   "2s ago",
		CreatedAt:   time.Now().Add(-24 * time.Hour),
		UpdatedAt:   time.Now(),
	},
	{
		ID:          "2",
		Name:        "Example.com",
		URL:         "https://example.com",
		Uptime:      100,
		Status:      "up",
		ResponseTime: 89,
		LastCheck:   "5s ago",
		CreatedAt:   time.Now().Add(-48 * time.Hour),
		UpdatedAt:   time.Now(),
	},
	{
		ID:          "4",
		Name:        "Google",
		URL:         "https://google.com",
		Uptime:      100,
		Status:      "up",
		ResponseTime: 67,
		LastCheck:   "1s ago",
		IsThirdParty: true,
		CreatedAt:   time.Now().Add(-72 * time.Hour),
		UpdatedAt:   time.Now(),
	},
	{
		ID:          "5",
		Name:        "MySQL",
		URL:         "mysql://localhost:3306",
		Uptime:      100,
		Status:      "up",
		ResponseTime: 12,
		LastCheck:   "3s ago",
		CreatedAt:   time.Now().Add(-12 * time.Hour),
		UpdatedAt:   time.Now(),
	},
	{
		ID:          "6",
		Name:        "Ping",
		URL:         "ping://8.8.8.8",
		Uptime:      100,
		Status:      "up",
		ResponseTime: 23,
		LastCheck:   "1s ago",
		CreatedAt:   time.Now().Add(-6 * time.Hour),
		UpdatedAt:   time.Now(),
	},
}

func getStats() StatsResponse {
	upCount := 0
	downCount := 0
	totalResponseTime := 0
	upResponseCount := 0

	for _, monitor := range monitors {
		if monitor.Status == "up" {
			upCount++
			totalResponseTime += monitor.ResponseTime
			upResponseCount++
		} else {
			downCount++
		}
	}

	avgResponseTime := 0
	if upResponseCount > 0 {
		avgResponseTime = totalResponseTime / upResponseCount
	}

	overallUptime := float64(upCount) / float64(len(monitors)) * 100

	return StatsResponse{
		OverallUptime:   overallUptime,
		ServicesUp:      upCount,
		ServicesDown:    downCount,
		AvgResponseTime: avgResponseTime,
	}
}

func getResponseTimeData(monitorID string) []ResponseTimeData {
	data := make([]ResponseTimeData, 50)
	now := time.Now()

	// Generate a seed based on monitor ID to create unique patterns
	seed := 0
	for _, char := range monitorID {
		seed += int(char)
	}

	for i := 0; i < 50; i++ {
		t := now.Add(-time.Duration(50-i) * time.Minute)
		
		// Base response time varies by monitor
		baseTime := 50.0 + float64(seed%150)
		
		// Add variation based on time and monitor
		variation := float64((i + seed) % 200)
		responseTime := baseTime + variation
		
		// Add occasional spikes (different positions for different monitors)
		spikePosition := (30 + seed) % 50
		if i == spikePosition {
			responseTime += 800.0 + float64(seed%400)
		}
		
		// Add some noise
		noise := float64((i*seed + seed) % 50)
		responseTime += noise

		data[i] = ResponseTimeData{
			Time:         t.Format("03:04 PM"),
			ResponseTime: responseTime,
		}
	}

	return data
}

func apiMonitors(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	json.NewEncoder(w).Encode(monitors)
}

func apiStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats := getStats()
	json.NewEncoder(w).Encode(stats)
}

func apiResponseTime(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	monitorID := r.URL.Query().Get("id")
	if monitorID == "" {
		monitorID = "1"
	}

	data := getResponseTimeData(monitorID)
	json.NewEncoder(w).Encode(data)
}

func apiMonitor(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "Missing id parameter", http.StatusBadRequest)
		return
	}

	for _, monitor := range monitors {
		if monitor.ID == id {
			json.NewEncoder(w).Encode(monitor)
			return
		}
	}

	http.Error(w, "Monitor not found", http.StatusNotFound)
}

func main() {
	// API routes
	http.HandleFunc("/api/monitors", apiMonitors)
	http.HandleFunc("/api/stats", apiStats)
	http.HandleFunc("/api/response-time", apiResponseTime)
	http.HandleFunc("/api/monitor", apiMonitor)

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
	log.Println("   GET /api/stats - Get overall statistics")
	log.Println("   GET /api/response-time?id=<id> - Get response time data")
	log.Println("   GET /api/monitor?id=<id> - Get specific monitor")
	log.Fatal(http.ListenAndServe(port, nil))
}

