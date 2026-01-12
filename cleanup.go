package main

import (
	"time"

	"github.com/rs/zerolog/log"
)

// cleanOldCheckHistory removes check history records older than 1 year
func cleanOldCheckHistory() {
	oneYearAgo := time.Now().Add(-365 * 24 * time.Hour)
	
	log.Info().Time("cutoff", oneYearAgo).Msg("[Cleanup] Starting cleanup of check history")
	
	var deletedCount int64
	result := db.Where("created_at < ?", oneYearAgo).Delete(&CheckHistory{})
	
	if result.Error != nil {
		log.Error().Err(result.Error).Msg("[Cleanup] Failed to clean old check history")
		return
	}
	
	deletedCount = result.RowsAffected
	log.Info().Int64("deleted", deletedCount).Msg("[Cleanup] Successfully deleted check history records")
}

// startCleanupScheduler starts a background job that runs cleanup daily at midnight
func startCleanupScheduler() {
	// Calculate time until next midnight
	now := time.Now()
	nextMidnight := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
	durationUntilMidnight := nextMidnight.Sub(now)
	
	log.Info().Time("next_cleanup", nextMidnight).Dur("duration", durationUntilMidnight).
		Msg("[Cleanup] Cleanup scheduler started")
	
	// Wait until midnight
	time.Sleep(durationUntilMidnight)
	
	// Run cleanup immediately at midnight
	cleanOldCheckHistory()
	
	// Then run cleanup every 24 hours
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			cleanOldCheckHistory()
		}
	}()
}

