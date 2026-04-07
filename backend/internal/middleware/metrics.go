package middleware

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/metrics"
)

// Metrics returns a Fiber middleware that records Prometheus metrics
// for every HTTP request (count, duration, response size).
func Metrics() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process request
		err := c.Next()

		// Record metrics
		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Response().StatusCode())
		method := c.Method()
		path := normalizePath(c.Route().Path)

		metrics.HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()
		metrics.HTTPRequestDuration.WithLabelValues(method, path).Observe(duration)
		metrics.HTTPResponseSize.WithLabelValues(method, path).Observe(float64(len(c.Response().Body())))

		return err
	}
}

// normalizePath returns the route pattern (not the actual path with params)
// to prevent high-cardinality labels.
func normalizePath(routePath string) string {
	if routePath == "" {
		return "unknown"
	}
	return routePath
}
