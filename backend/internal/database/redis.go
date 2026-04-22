package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/tivify/backend/internal/config"
)

const (
	redisConnectMaxAttempts = 10
	redisConnectBaseDelay   = 500 * time.Millisecond
	redisConnectMaxDelay    = 5 * time.Second
	redisPingTimeout        = 3 * time.Second
)

func NewRedis(cfg *config.Config) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
		Password:     cfg.RedisPassword,
		DB:           0,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	var lastErr error
	for attempt := 1; attempt <= redisConnectMaxAttempts; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), redisPingTimeout)
		err := client.Ping(ctx).Err()
		cancel()
		if err == nil {
			log.Println("Redis conectado correctamente")
			return client
		}
		lastErr = err
		delay := redisConnectBaseDelay * (1 << (attempt - 1))
		if delay > redisConnectMaxDelay {
			delay = redisConnectMaxDelay
		}
		log.Printf("WARN [REDIS] connect attempt %d/%d failed: %v; retrying in %v",
			attempt, redisConnectMaxAttempts, err, delay)
		time.Sleep(delay)
	}
	log.Fatalf("Error conectando a Redis tras %d intentos: %v", redisConnectMaxAttempts, lastErr)
	return nil
}
