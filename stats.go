package main

import (
	"database/sql"
	"time"

	"github.com/rs/zerolog/log"
)

// getStats calculates overall statistics from all monitors using database aggregation
func getStats() StatsResponse {
	// Use database aggregation to calculate stats without loading all monitors
	var stats struct {
		UnpausedCount int64
		UpCount       int64
		DownCount     int64
		TotalUptime   float64
	}
	
	db.Model(&Monitor{}).
		Select(`
			COUNT(*) as unpaused_count,
			SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
			SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down_count,
			SUM(uptime) as total_uptime
		`).
		Where("paused = ?", false).
		Scan(&stats)
	
	upCount := int(stats.UpCount)
	downCount := int(stats.DownCount)
	unpausedCount := int(stats.UnpausedCount)
	totalUptime := stats.TotalUptime

	// Calculate average response time from all check history in last 24 hours
	// This gives a more accurate average across all checks, not just the last check per monitor
	var avgResponseTime int
	twentyFourHoursAgo := time.Now().Add(-24 * time.Hour)
	
	// Use raw SQL query to get average response time (GORM uses snake_case for column names)
	var avgResult sql.NullFloat64
	var countResult int64
	
	// Get count first
	db.Model(&CheckHistory{}).
		Where("created_at > ? AND response_time > 0 AND status = ?", twentyFourHoursAgo, "up").
		Count(&countResult)
	
	if countResult > 0 {
		// Use raw SQL to ensure correct column name
		err := db.Raw(`
			SELECT AVG(response_time) as avg_response_time 
			FROM check_histories 
			WHERE created_at > ? AND response_time > 0 AND status = ?
		`, twentyFourHoursAgo, "up").Row().Scan(&avgResult)
		
		if err == nil && avgResult.Valid {
			avgResponseTime = int(avgResult.Float64)
			log.Debug().Int64("checks", countResult).Int("avg_ms", avgResponseTime).Msg("[Stats] Calculated avg response time")
		} else {
			log.Warn().Err(err).Int64("count", countResult).Msg("[Stats] Error calculating avg response time")
		}
	} else {
		log.Debug().Msg("[Stats] No check history found in last 24 hours")
	}
	
	// Fallback: calculate from current monitor response times if no history or query failed
	if countResult == 0 || avgResponseTime == 0 {
		var fallbackStats struct {
			TotalResponseTime int64
			ResponseCount      int64
		}
		
		db.Model(&Monitor{}).
			Select(`
				SUM(response_time) as total_response_time,
				COUNT(*) as response_count
			`).
			Where("paused = ? AND response_time > 0 AND status = ?", false, "up").
			Scan(&fallbackStats)
		
		if fallbackStats.ResponseCount > 0 {
			avgResponseTime = int(fallbackStats.TotalResponseTime / fallbackStats.ResponseCount)
			log.Debug().Int64("monitors", fallbackStats.ResponseCount).Int("avg_ms", avgResponseTime).Msg("[Stats] Using fallback avg response time")
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

