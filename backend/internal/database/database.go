package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/tivify/backend/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Retry parameters used when Postgres is not immediately ready at startup
// (common in container orchestrations where dependent services race).
const (
	dbConnectMaxAttempts = 10
	dbConnectBaseDelay   = 500 * time.Millisecond
	dbConnectMaxDelay    = 5 * time.Second
	dbPingTimeout        = 3 * time.Second
)

func NewPostgres(cfg *config.Config) *gorm.DB {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)

	logLevel := logger.Silent
	if cfg.AppEnv == "development" {
		logLevel = logger.Info
	}

	var (
		db      *gorm.DB
		lastErr error
	)
	for attempt := 1; attempt <= dbConnectMaxAttempts; attempt++ {
		var err error
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logLevel),
		})
		if err == nil {
			sqlDB, innerErr := db.DB()
			if innerErr == nil {
				ctx, cancel := context.WithTimeout(context.Background(), dbPingTimeout)
				pingErr := sqlDB.PingContext(ctx)
				cancel()
				if pingErr == nil {
					// Success: apply pool settings and return.
					sqlDB.SetMaxIdleConns(cfg.DBMaxIdleConns)
					sqlDB.SetMaxOpenConns(cfg.DBMaxOpenConns)
					sqlDB.SetConnMaxLifetime(cfg.DBConnMaxLifetime)
					log.Printf("PostgreSQL conectado correctamente (pool: %d idle, %d open, %v lifetime)",
						cfg.DBMaxIdleConns, cfg.DBMaxOpenConns, cfg.DBConnMaxLifetime)
					return db
				}
				lastErr = pingErr
			} else {
				lastErr = innerErr
			}
		} else {
			lastErr = err
		}

		delay := dbConnectBaseDelay * (1 << (attempt - 1))
		if delay > dbConnectMaxDelay {
			delay = dbConnectMaxDelay
		}
		log.Printf("WARN [DB] connect attempt %d/%d failed: %v; retrying in %v",
			attempt, dbConnectMaxAttempts, lastErr, delay)
		time.Sleep(delay)
	}

	log.Fatalf("Error conectando a PostgreSQL tras %d intentos: %v", dbConnectMaxAttempts, lastErr)
	return nil
}
