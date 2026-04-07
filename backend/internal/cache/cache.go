package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

type CacheService struct {
	client *redis.Client
}

func NewCacheService(client *redis.Client) *CacheService {
	return &CacheService{
		client: client,
	}
}

// Get retrieves a cached value and unmarshals it into dest.
// Returns false if key does not exist or on error.
func (c *CacheService) Get(key string, dest interface{}) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	val, err := c.client.Get(ctx, key).Result()
	if err != nil {
		return false
	}
	if err := json.Unmarshal([]byte(val), dest); err != nil {
		return false
	}
	return true
}

// Set stores a value in cache with the given TTL.
func (c *CacheService) Set(key string, value interface{}, ttl time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, data, ttl).Err()
}

// Delete removes a key from cache.
func (c *CacheService) Delete(key string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return c.client.Del(ctx, key).Err()
}

// DeletePrefix removes all keys matching a prefix pattern using SCAN and pipeline for reliability.
// Uses a timeout context and pipeline for batch deletes instead of individual Del calls.
func (c *CacheService) DeletePrefix(prefix string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// SCAN for keys matching pattern
	var keys []string
	iter := c.client.Scan(ctx, 0, prefix+"*", 1000).Iterator()
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}

	if err := iter.Err(); err != nil {
		return err
	}

	// If no keys found, return early
	if len(keys) == 0 {
		return nil
	}

	// Use pipeline for batch delete instead of individual Del calls
	pipe := c.client.Pipeline()
	for _, key := range keys {
		pipe.Del(ctx, key)
	}

	_, err := pipe.Exec(ctx)
	return err
}
