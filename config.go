package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"
)

// MonitorConfig represents a monitor in the YAML configuration
type MonitorConfig struct {
	Name         string `yaml:"name"`
	URL          string `yaml:"url"`
	Icon         string `yaml:"icon,omitempty"`
	CheckInterval int   `yaml:"checkInterval,omitempty"`
	IsThirdParty bool   `yaml:"isThirdParty,omitempty"`
	Paused       bool   `yaml:"paused,omitempty"`
}

// ConfigFile represents the root of the YAML configuration
type ConfigFile struct {
	Monitors []MonitorConfig `yaml:"monitors"`
}

// loadMonitorsFromYAML loads monitors from a YAML configuration file
// Returns monitors with their config hashes calculated
func loadMonitorsFromYAML(configPath string) ([]Monitor, []string, error) {
	if configPath == "" {
		return nil, nil, nil // No config file specified
	}

	// Check if file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		log.Debug().Str("config_path", configPath).Msg("[Config] Configuration file not found")
		return nil, nil, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config ConfigFile
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	monitors := make([]Monitor, 0, len(config.Monitors))
	hashes := make([]string, 0, len(config.Monitors))
	
		for _, cfg := range config.Monitors {
		// Validate required fields
		if cfg.Name == "" || cfg.URL == "" {
			log.Warn().Msg("[Config] Skipping monitor with missing name or URL")
			continue
		}

		// Set default check interval
		checkInterval := cfg.CheckInterval
		if checkInterval <= 0 {
			checkInterval = 60
		}

		// Calculate hash for this config
		configHash := calculateConfigHash(cfg)

		monitor := Monitor{
			Name:         cfg.Name,
			URL:          cfg.URL,
			Icon:         cfg.Icon,
			CheckInterval: checkInterval,
			IsThirdParty: cfg.IsThirdParty,
			Paused:       cfg.Paused,
			ConfigHash:   configHash,
			Status:       "unknown",
			Uptime:       0,
			ResponseTime: 0,
			LastCheck:    "never",
		}

		monitors = append(monitors, monitor)
		hashes = append(hashes, configHash)
	}

	log.Info().Int("count", len(monitors)).Str("config_path", configPath).Msg("[Config] Loaded monitors")
	return monitors, hashes, nil
}

// calculateConfigHash calculates a SHA256 hash of the monitor configuration
// This hash is used to detect changes in YAML config
func calculateConfigHash(cfg MonitorConfig) string {
	// Create a deterministic string representation of the config
	configStr := fmt.Sprintf("%s|%s|%s|%d|%v|%v",
		cfg.Name,
		cfg.URL,
		cfg.Icon,
		cfg.CheckInterval,
		cfg.IsThirdParty,
		cfg.Paused,
	)
	
	hash := sha256.Sum256([]byte(configStr))
	return hex.EncodeToString(hash[:])
}

