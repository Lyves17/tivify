package util

import "testing"

func TestInitLogger(t *testing.T) {
	// Should not panic
	InitLogger()
}

func TestNewLogger(t *testing.T) {
	logger := NewLogger("test-component")
	if logger == nil {
		t.Fatal("NewLogger returned nil")
	}
	if logger.logger == nil {
		t.Fatal("NewLogger logger field is nil")
	}
}

func TestLogger_LogMethods(t *testing.T) {
	InitLogger()
	logger := NewLogger("test")

	// These should not panic
	logger.Info("test info")
	logger.Warn("test warn")
	logger.Error("test error")
	logger.Debug("test debug")
}

func TestLogger_LogMethodsWithArgs(t *testing.T) {
	InitLogger()
	logger := NewLogger("test")

	// With key-value pairs
	logger.Info("test info", "key", "value")
	logger.Warn("test warn", "count", 42)
	logger.Error("test error", "err", "something failed")
}

func TestToSlogAttrs_Empty(t *testing.T) {
	result := toSlogAttrs(nil)
	if result != nil {
		t.Errorf("expected nil for empty args, got %v", result)
	}

	result = toSlogAttrs([]interface{}{})
	if result != nil {
		t.Errorf("expected nil for empty slice, got %v", result)
	}
}

func TestToSlogAttrs_KeyValuePairs(t *testing.T) {
	args := []interface{}{"key1", "val1", "key2", 42}
	result := toSlogAttrs(args)
	if len(result) != 4 {
		t.Errorf("expected 4 elements, got %d", len(result))
	}
}

func TestToSlogAttrs_OddArgs(t *testing.T) {
	args := []interface{}{"single"}
	result := toSlogAttrs(args)
	if len(result) != 2 {
		t.Errorf("expected 2 elements (data, args), got %d", len(result))
	}
	if result[0] != "data" {
		t.Errorf("expected first element 'data', got %v", result[0])
	}
}

func TestToSlogAttrs_NonStringFirstArg(t *testing.T) {
	args := []interface{}{42, "val"}
	result := toSlogAttrs(args)
	// First arg is not string, so wraps as "data"
	if len(result) != 2 {
		t.Errorf("expected 2 elements, got %d", len(result))
	}
}

func TestLogConvenienceFunctions(t *testing.T) {
	InitLogger()

	// Package-level functions should not panic
	LogInfo("test", "info message")
	LogWarn("test", "warn message")
	LogError("test", "error message")
	LogDebug("test", "debug message")
}

func TestLogConvenienceFunctions_WithArgs(t *testing.T) {
	InitLogger()

	LogInfo("test", "info", "key", "value")
	LogWarn("test", "warn", "count", 5)
	LogError("test", "error", "err", "fail")
	LogDebug("test", "debug", "verbose", true)
}
