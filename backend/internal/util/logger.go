package util

import (
	"log/slog"
	"os"
)

// InitLogger configures the global slog logger with JSON output.
func InitLogger() {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	slog.SetDefault(slog.New(handler))
}

// Logger provides structured logging with component context.
type Logger struct {
	logger *slog.Logger
}

// NewLogger creates a new logger for a specific component.
func NewLogger(component string) *Logger {
	return &Logger{
		logger: slog.Default().With("component", component),
	}
}

func (l *Logger) Info(format string, args ...interface{}) {
	l.logger.Info(format, toSlogAttrs(args)...)
}

func (l *Logger) Warn(format string, args ...interface{}) {
	l.logger.Warn(format, toSlogAttrs(args)...)
}

func (l *Logger) Error(format string, args ...interface{}) {
	l.logger.Error(format, toSlogAttrs(args)...)
}

func (l *Logger) Debug(format string, args ...interface{}) {
	l.logger.Debug(format, toSlogAttrs(args)...)
}

// toSlogAttrs converts variadic args to slog key-value pairs.
// If args are slog.Attr or key-value pairs, they pass through.
// Otherwise, they are logged as a single "data" field.
func toSlogAttrs(args []interface{}) []any {
	if len(args) == 0 {
		return nil
	}
	// If first arg is a string and we have pairs, treat as key-value
	if len(args)%2 == 0 {
		if _, ok := args[0].(string); ok {
			return args
		}
	}
	return []any{"data", args}
}

// Package-level convenience functions

func LogInfo(component, msg string, args ...interface{}) {
	NewLogger(component).Info(msg, args...)
}

func LogWarn(component, msg string, args ...interface{}) {
	NewLogger(component).Warn(msg, args...)
}

func LogError(component, msg string, args ...interface{}) {
	NewLogger(component).Error(msg, args...)
}

func LogDebug(component, msg string, args ...interface{}) {
	NewLogger(component).Debug(msg, args...)
}
