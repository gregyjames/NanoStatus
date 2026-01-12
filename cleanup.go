package main

import (
	"time"

	"github.com/go-co-op/gocron/v2"
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

// bucketOldCheckHistory aggregates CheckHistory records older than 24 hours into hourly buckets
func bucketOldCheckHistory() {
	cutoffTime := time.Now().Add(-24 * time.Hour)
	
	log.Info().Time("cutoff", cutoffTime).Msg("[Bucketing] Starting check history bucketing")
	
	// Get all monitors
	var monitors []Monitor
	if err := db.Find(&monitors).Error; err != nil {
		log.Error().Err(err).Msg("[Bucketing] Failed to load monitors")
		return
	}
	
	totalBucketed := 0
	
	for _, monitor := range monitors {
		// Get all check history records older than 24 hours for this monitor
		var oldChecks []CheckHistory
		if err := db.Where("monitor_id = ? AND created_at < ?", monitor.ID, cutoffTime).
			Order("created_at ASC").
			Find(&oldChecks).Error; err != nil {
			log.Error().Err(err).Uint("monitor_id", monitor.ID).Msg("[Bucketing] Failed to load old checks")
			continue
		}
		
		if len(oldChecks) == 0 {
			continue
		}
		
		// Group checks by hour
		buckets := make(map[int64]*CheckHistoryBucket)
		
		for _, check := range oldChecks {
			// Round to hour
			bucketHour := check.CreatedAt.Truncate(time.Hour).Unix()
			
			bucket, exists := buckets[bucketHour]
			if !exists {
				bucket = &CheckHistoryBucket{
					MonitorID:      monitor.ID,
					BucketHour:     bucketHour,
					TotalChecks:    0,
					UpChecks:       0,
					AvgResponseTime: 0,
					MinResponseTime: 0,
					MaxResponseTime: 0,
					CreatedAt:      time.Now(),
				}
				buckets[bucketHour] = bucket
			}
			
			bucket.TotalChecks++
			if check.Status == "up" {
				bucket.UpChecks++
			}
			
			if check.ResponseTime > 0 {
				if bucket.MinResponseTime == 0 || check.ResponseTime < bucket.MinResponseTime {
					bucket.MinResponseTime = check.ResponseTime
				}
				if check.ResponseTime > bucket.MaxResponseTime {
					bucket.MaxResponseTime = check.ResponseTime
				}
			}
		}
		
		// Calculate averages and upsert buckets
		for _, bucket := range buckets {
			// Calculate average response time (we'll need to recalculate from raw data)
			var responseTimes []int
			for _, check := range oldChecks {
				checkHour := check.CreatedAt.Truncate(time.Hour).Unix()
				if checkHour == bucket.BucketHour && check.ResponseTime > 0 {
					responseTimes = append(responseTimes, check.ResponseTime)
				}
			}
			
			if len(responseTimes) > 0 {
				sum := 0
				for _, rt := range responseTimes {
					sum += rt
				}
				bucket.AvgResponseTime = float64(sum) / float64(len(responseTimes))
			}
			
			// Upsert bucket (use ON CONFLICT for SQLite)
			// First try to update existing bucket
			result := db.Model(&CheckHistoryBucket{}).
				Where("monitor_id = ? AND bucket_hour = ?", bucket.MonitorID, bucket.BucketHour).
				Updates(map[string]interface{}{
					"total_checks":      bucket.TotalChecks,
					"up_checks":          bucket.UpChecks,
					"avg_response_time":  bucket.AvgResponseTime,
					"min_response_time":  bucket.MinResponseTime,
					"max_response_time":  bucket.MaxResponseTime,
				})
			
			// If no rows updated, insert new bucket
			if result.Error != nil {
				log.Error().Err(result.Error).Uint("monitor_id", monitor.ID).Int64("bucket_hour", bucket.BucketHour).
					Msg("[Bucketing] Failed to update bucket")
				continue
			}
			
			if result.RowsAffected == 0 {
				// No existing bucket, create new one
				if err := db.Create(bucket).Error; err != nil {
					log.Error().Err(err).Uint("monitor_id", monitor.ID).Int64("bucket_hour", bucket.BucketHour).
						Msg("[Bucketing] Failed to create bucket")
					continue
				}
			}
			
			totalBucketed++
		}
		
		// Delete old raw records after bucketing (keep last 7 days raw for detailed charts)
		sevenDaysAgo := time.Now().Add(-7 * 24 * time.Hour)
		result := db.Where("monitor_id = ? AND created_at < ?", monitor.ID, sevenDaysAgo).
			Delete(&CheckHistory{})
		
		if result.Error != nil {
			log.Error().Err(result.Error).Uint("monitor_id", monitor.ID).
				Msg("[Bucketing] Failed to delete old raw records")
		} else {
			log.Debug().Uint("monitor_id", monitor.ID).
				Int64("deleted", result.RowsAffected).
				Msg("[Bucketing] Deleted old raw records")
		}
	}
	
	log.Info().Int("buckets_created", totalBucketed).Msg("[Bucketing] Completed check history bucketing")
}

var cleanupScheduler gocron.Scheduler

// startCleanupScheduler starts a background job that runs cleanup daily at midnight using gocron
func startCleanupScheduler() {
	// Create a new scheduler for cleanup jobs
	sched, err := gocron.NewScheduler()
	if err != nil {
		log.Fatal().Err(err).Msg("[Cleanup] Failed to create cleanup scheduler")
	}
	
	cleanupScheduler = sched
	
	// Schedule cleanup job to run daily at midnight (00:00)
	// Cron expression: "0 0 * * *" means: minute=0, hour=0, every day, every month, every weekday
	_, err = cleanupScheduler.NewJob(
		gocron.CronJob("0 0 * * *", false),
		gocron.NewTask(func() {
			log.Info().Msg("[Cleanup] Running scheduled cleanup and bucketing")
			cleanOldCheckHistory()
			bucketOldCheckHistory()
		}),
		gocron.WithName("daily-cleanup"),
	)
	
	if err != nil {
		log.Fatal().Err(err).Msg("[Cleanup] Failed to schedule cleanup job")
	}
	
	// Start the scheduler
	cleanupScheduler.Start()
	log.Info().Msg("[Cleanup] Cleanup scheduler started - will run daily at midnight")
}

