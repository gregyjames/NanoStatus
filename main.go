package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"gorm.io/gorm"
)

//go:embed dist
var staticFiles embed.FS

var db *gorm.DB

func main() {
	// Initialize database
	initDB()

	// Start background checker
	startChecker()
	
	// Start cleanup scheduler (runs daily at midnight)
	go startCleanupScheduler()

	// API routes
	http.HandleFunc("/api/monitors", apiMonitors)
	http.HandleFunc("/api/monitors/create", apiCreateMonitor)
	http.HandleFunc("/api/monitors/export", apiExportMonitors)
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

		// Try to open the file - if it exists, serve it directly
		file, err := staticFS.Open(path)
		if err == nil {
			// File exists, let FileServer handle it (will close the file)
			file.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// File doesn't exist, serve index.html for SPA routing
		// Use FileServer to serve index.html efficiently
		r.URL.Path = "/index.html"
		fileServer.ServeHTTP(w, r)
	})

	port := ":8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = ":" + envPort
	}

	log.Printf("🚀 Server starting on port %s", port)
	log.Println("📊 API endpoints:")
	log.Println("   GET /api/monitors - List all monitors")
	log.Println("   POST /api/monitors/create - Create a new monitor")
	log.Println("   GET /api/monitors/export - Export monitors as YAML")
	log.Println("   GET /api/stats - Get overall statistics")
	log.Println("   GET /api/response-time?id=<id>&range=<range> - Get response time data")
	log.Println("   GET /api/monitor?id=<id> - Get specific monitor")
	log.Println("   PUT /api/monitor?id=<id> - Update monitor")
	log.Println("   DELETE /api/monitor?id=<id> - Delete a monitor")
	log.Println("   GET /api/events - Server-Sent Events stream")
	log.Fatal(http.ListenAndServe(port, nil))
}
