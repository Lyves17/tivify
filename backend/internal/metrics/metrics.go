package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP metrics
	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "tivify_http_requests_total",
		Help: "Total number of HTTP requests",
	}, []string{"method", "path", "status"})

	HTTPRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "tivify_http_request_duration_seconds",
		Help:    "HTTP request duration in seconds",
		Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
	}, []string{"method", "path"})

	HTTPResponseSize = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "tivify_http_response_size_bytes",
		Help:    "HTTP response size in bytes",
		Buckets: prometheus.ExponentialBuckets(100, 10, 7), // 100B to 100MB
	}, []string{"method", "path"})

	// Business metrics
	ActiveWebSocketConnections = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "tivify_websocket_connections_active",
		Help: "Number of active WebSocket connections",
	})

	ActiveStreams = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "tivify_streams_active",
		Help: "Number of active streaming emissions",
	})

	TranscodeJobsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "tivify_transcode_jobs_total",
		Help: "Total number of transcode jobs by status",
	}, []string{"status"}) // started, completed, failed

	ActiveSessions = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "tivify_sessions_active",
		Help: "Number of active user sessions",
	})

	LoginAttemptsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "tivify_login_attempts_total",
		Help: "Total login attempts by result",
	}, []string{"result"}) // success, invalid_credentials, inactive, expired, max_connections

	SearchRequestsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "tivify_search_requests_total",
		Help: "Total number of search requests",
	})

	CacheHitsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "tivify_cache_hits_total",
		Help: "Total cache hits and misses",
	}, []string{"result"}) // hit, miss
)
