package cache

import (
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func setupTestRedis(t *testing.T) (*CacheService, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	t.Cleanup(func() { mr.Close() })
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewCacheService(client), mr
}

func TestNewCacheService(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer mr.Close()
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	svc := NewCacheService(client)
	if svc == nil {
		t.Fatal("expected non-nil CacheService")
	}
	if svc.client != client {
		t.Error("expected client to be set")
	}
}

func TestCacheService_Get_Success(t *testing.T) {
	svc, mr := setupTestRedis(t)

	// Manually set a JSON value in redis
	mr.Set("test-key", `{"name":"hello","value":42}`)

	var dest struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}
	ok := svc.Get("test-key", &dest)
	if !ok {
		t.Fatal("expected Get to return true")
	}
	if dest.Name != "hello" {
		t.Errorf("expected name 'hello', got %q", dest.Name)
	}
	if dest.Value != 42 {
		t.Errorf("expected value 42, got %d", dest.Value)
	}
}

func TestCacheService_Get_NotFound(t *testing.T) {
	svc, _ := setupTestRedis(t)

	var dest struct{}
	ok := svc.Get("nonexistent-key", &dest)
	if ok {
		t.Error("expected Get to return false for nonexistent key")
	}
}

func TestCacheService_Get_InvalidJSON(t *testing.T) {
	svc, mr := setupTestRedis(t)

	mr.Set("bad-json", "not-valid-json{{{")

	var dest struct {
		Name string `json:"name"`
	}
	ok := svc.Get("bad-json", &dest)
	if ok {
		t.Error("expected Get to return false for invalid JSON")
	}
}

func TestCacheService_Set_Success(t *testing.T) {
	svc, mr := setupTestRedis(t)

	data := struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}{Name: "test", Value: 100}

	err := svc.Set("my-key", data, 5*time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify the key was set in miniredis
	got, err := mr.Get("my-key")
	if err != nil {
		t.Fatalf("key not found in redis: %v", err)
	}
	if got == "" {
		t.Fatal("expected non-empty value")
	}

	// Verify TTL was set
	ttl := mr.TTL("my-key")
	if ttl <= 0 {
		t.Errorf("expected positive TTL, got %v", ttl)
	}
}

func TestCacheService_Set_MarshalError(t *testing.T) {
	svc, _ := setupTestRedis(t)

	// channels cannot be marshaled to JSON
	ch := make(chan int)
	err := svc.Set("bad-key", ch, time.Minute)
	if err == nil {
		t.Error("expected marshal error for channel type")
	}
}

func TestCacheService_Delete_Success(t *testing.T) {
	svc, mr := setupTestRedis(t)

	mr.Set("delete-me", "some-value")

	err := svc.Delete("delete-me")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if mr.Exists("delete-me") {
		t.Error("expected key to be deleted")
	}
}

func TestCacheService_Delete_NonexistentKey(t *testing.T) {
	svc, _ := setupTestRedis(t)

	// Deleting a nonexistent key should not error
	err := svc.Delete("does-not-exist")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCacheService_DeletePrefix_WithMatches(t *testing.T) {
	svc, mr := setupTestRedis(t)

	mr.Set("prefix:one", "1")
	mr.Set("prefix:two", "2")
	mr.Set("prefix:three", "3")
	mr.Set("other:key", "4")

	err := svc.DeletePrefix("prefix:")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if mr.Exists("prefix:one") || mr.Exists("prefix:two") || mr.Exists("prefix:three") {
		t.Error("expected all prefix: keys to be deleted")
	}
	if !mr.Exists("other:key") {
		t.Error("expected other:key to still exist")
	}
}

func TestCacheService_DeletePrefix_NoMatches(t *testing.T) {
	svc, mr := setupTestRedis(t)

	mr.Set("keep:this", "value")

	err := svc.DeletePrefix("nonexistent:")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !mr.Exists("keep:this") {
		t.Error("expected keep:this to still exist")
	}
}

func TestCacheService_SetThenGet(t *testing.T) {
	svc, _ := setupTestRedis(t)

	type TestData struct {
		Items []string `json:"items"`
		Count int      `json:"count"`
	}

	original := TestData{Items: []string{"a", "b", "c"}, Count: 3}
	err := svc.Set("round-trip", original, 10*time.Minute)
	if err != nil {
		t.Fatalf("Set error: %v", err)
	}

	var retrieved TestData
	ok := svc.Get("round-trip", &retrieved)
	if !ok {
		t.Fatal("expected Get to return true")
	}
	if retrieved.Count != 3 {
		t.Errorf("expected count 3, got %d", retrieved.Count)
	}
	if len(retrieved.Items) != 3 {
		t.Errorf("expected 3 items, got %d", len(retrieved.Items))
	}
}
