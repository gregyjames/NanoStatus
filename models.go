package main

import "time"

// Monitor represents a service being monitored
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

// CreateMonitorRequest represents the request body for creating a monitor
type CreateMonitorRequest struct {
	Name         string `json:"name"`
	URL          string `json:"url"`
	IsThirdParty bool   `json:"isThirdParty,omitempty"`
	Icon         string `json:"icon,omitempty"`
	CheckInterval int   `json:"checkInterval,omitempty"` // Interval in seconds (default: 60)
}

// StatsResponse represents overall statistics
type StatsResponse struct {
	OverallUptime   float64 `json:"overallUptime"`
	ServicesUp      int     `json:"servicesUp"`
	ServicesDown    int     `json:"servicesDown"`
	AvgResponseTime int     `json:"avgResponseTime"`
}

// CheckHistory stores historical check data
type CheckHistory struct {
	ID           uint      `gorm:"primaryKey"`
	MonitorID    uint      `gorm:"not null;index"`
	Status       string    `gorm:"not null"`
	ResponseTime int       `gorm:"default:0"`
	CreatedAt    time.Time `gorm:"index"`
}

// ResponseTimeData represents formatted response time data for charts
type ResponseTimeData struct {
	Time         string  `json:"time"`         // Formatted time string (for display)
	Timestamp    string  `json:"timestamp"`    // ISO 8601 timestamp (for client-side formatting)
	ResponseTime float64 `json:"responseTime"`
}

