package router

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"github.com/tivify/backend/internal/handler"
	"github.com/tivify/backend/internal/middleware"
	"github.com/tivify/backend/internal/util"
	"github.com/tivify/backend/internal/version"
	"github.com/tivify/backend/internal/ws"
	"gorm.io/gorm"
)

type Handlers struct {
	Auth           *handler.AuthHandler
	Category       *handler.CategoryHandler
	Channel        *handler.ChannelHandler
	VOD            *handler.VODHandler
	Series         *handler.SeriesHandler
	User           *handler.UserHandler
	EPG            *handler.EPGHandler
	Favorite       *handler.FavoriteHandler
	WatchHistory   *handler.WatchHistoryHandler
	Dashboard      *handler.DashboardHandler
	LocalMedia     *handler.LocalMediaHandler
	Playlist       *handler.PlaylistHandler
	Emission       *handler.EmissionHandler
	LibraryScanner *handler.LibraryScannerHandler
	IPTV           *handler.IPTVHandler
	Search         *handler.SearchHandler
	Tailscale      *handler.TailscaleHandler
}

// HealthDeps contiene las dependencias necesarias para el health check profundo.
type HealthDeps struct {
	DB    *gorm.DB
	Redis *redis.Client
}

var startTime = time.Now()

func Setup(app *fiber.App, h *Handlers, corsOrigin string, health *HealthDeps, wsHub *ws.Hub) {
	// Middleware global
	app.Use(recover.New())
	app.Use(middleware.RequestID()) // Add request ID for tracing
	app.Use(middleware.Metrics())   // Prometheus HTTP metrics
	app.Use(logger.New(logger.Config{
		Format: "${time} | ${status} | ${latency} | ${ip} | ${method} | ${path}\n",
	}))
	app.Use(middleware.CORS(corsOrigin))

	// Prometheus metrics endpoint
	app.Get("/metrics", adaptor.HTTPHandler(promhttp.Handler()))

	// Health check profundo: verifica conectividad con PostgreSQL y Redis
	app.Get("/health", func(c *fiber.Ctx) error {
		status := fiber.Map{"status": "ok"}
		httpStatus := fiber.StatusOK

		// Verificar PostgreSQL
		sqlDB, err := health.DB.DB()
		if err != nil || sqlDB.Ping() != nil {
			status["database"] = "error"
			httpStatus = fiber.StatusServiceUnavailable
		} else {
			status["database"] = "ok"
		}

		// Verificar Redis
		if health.Redis.Ping(context.Background()).Err() != nil {
			status["redis"] = "error"
			httpStatus = fiber.StatusServiceUnavailable
		} else {
			status["redis"] = "ok"
		}

		if httpStatus != fiber.StatusOK {
			status["status"] = "degraded"
		}

		status["uptime"] = time.Since(startTime).String()
		status["version"] = version.Version

		return c.Status(httpStatus).JSON(status)
	})

	// Version info (publica) - rate limited
	app.Get("/api/version", middleware.RateLimitRelaxed(), func(c *fiber.Ctx) error {
		return util.Success(c, fiber.Map{
			"version":    version.Version,
			"build_date": version.BuildDate,
		})
	})

	// Validacion interna de stream tokens (usado por nginx auth_request)
	// IMPORTANTE: Protegido por InternalOnly middleware - solo accesible desde localhost
	app.Get("/api/internal/validate-stream-token", middleware.InternalOnly(), func(c *fiber.Ctx) error {
		token := c.Query("token")
		if token == "" {
			// Intentar extraer del header Authorization
			auth := c.Get("Authorization")
			if len(auth) > 7 && auth[:7] == "Bearer " {
				token = auth[7:]
			}
		}
		if token == "" {
			return c.SendStatus(fiber.StatusUnauthorized)
		}
		if _, err := util.ValidateAccessToken(token); err != nil {
			return c.SendStatus(fiber.StatusUnauthorized)
		}
		return c.SendStatus(fiber.StatusOK)
	})

	// WebSocket endpoint for real-time events
	// Auth via ?token= query parameter
	app.Use("/ws", ws.UpgradeMiddleware())
	app.Get("/ws", ws.Handler(wsHub))

	// API v1
	SetupAPIv1(app, h)
}

func SetupAPIv1(app *fiber.App, h *Handlers) {
	v1 := app.Group("/api/v1")

	// --- Auth routes (publicas) - strict rate limit ---
	auth := v1.Group("/auth")
	auth.Use(middleware.RateLimitStrict()) // 5 requests per minute
	auth.Post("/login", h.Auth.Login)
	auth.Post("/refresh", h.Auth.Refresh)
	auth.Post("/logout", h.Auth.Logout)

	// Auth routes (protegidas)
	authProtected := v1.Group("/auth", middleware.AuthRequired())
	authProtected.Get("/me", h.Auth.Me)

	// --- Admin routes ---
	admin := v1.Group("/admin", middleware.AuthRequired(), middleware.AdminRequired())

	// Dashboard
	admin.Get("/dashboard/stats", h.Dashboard.Stats)

	// Categories
	admin.Get("/categories", h.Category.List)
	admin.Get("/categories/by-type", h.Category.ListByType)
	admin.Get("/categories/:id", h.Category.GetByID)
	admin.Post("/categories", h.Category.Create)
	admin.Put("/categories/:id", h.Category.Update)
	admin.Delete("/categories/:id", h.Category.Delete)

	// Channels
	admin.Get("/channels", h.Channel.List)
	admin.Get("/channels/:id", h.Channel.GetByID)
	admin.Post("/channels", h.Channel.Create)
	admin.Put("/channels/:id", h.Channel.Update)
	admin.Delete("/channels/:id", h.Channel.Delete)
	admin.Post("/channels/:id/streams", h.Channel.AddStream)
	admin.Put("/channels/:id/streams/:streamId", h.Channel.UpdateStream)
	admin.Delete("/channels/:id/streams/:streamId", h.Channel.DeleteStream)

	// Channel Playlist (emision local)
	admin.Get("/channels/:id/playlist", h.Playlist.GetByChannel)
	admin.Post("/channels/:id/playlist/items", h.Playlist.AddItem)
	admin.Delete("/channels/:id/playlist/items/:itemId", h.Playlist.RemoveItem)
	admin.Put("/channels/:id/playlist/reorder", h.Playlist.Reorder)
	admin.Put("/channels/:id/playlist/mode", h.Playlist.UpdateMode)
	admin.Post("/channels/:id/playlist/generate", h.Playlist.GenerateStream)

	// Emission (emision en vivo con ffmpeg)
	admin.Post("/channels/:id/emission/start", h.Emission.Start)
	admin.Post("/channels/:id/emission/stop", h.Emission.Stop)
	admin.Get("/channels/:id/emission/status", h.Emission.Status)

	// Local Media - with large file upload limits
	// B13: Add rate limiting to upload endpoints (5 uploads per minute per user)
	admin.Post("/media/upload", middleware.BodyLimitLargeFile(), middleware.RateLimitUpload(), h.LocalMedia.Upload)
	admin.Post("/media/upload-vod", middleware.BodyLimitLargeFile(), middleware.RateLimitUpload(), h.LocalMedia.UploadAndCreateVOD)
	admin.Get("/media/diagnostics", h.LocalMedia.Diagnostics)
	admin.Get("/media", h.LocalMedia.List)
	admin.Get("/media/:id", h.LocalMedia.GetByID)
	admin.Delete("/media/:id", h.LocalMedia.Delete)
	admin.Post("/media/:id/create-vod", h.LocalMedia.CreateVOD)

	// VOD
	admin.Get("/vod", h.VOD.List)
	admin.Get("/vod/debug", h.VOD.DebugStats) // endpoint diagnostico
	admin.Post("/vod/enrich", h.VOD.EnrichWithTMDB)
	admin.Get("/vod/:id", h.VOD.GetByID)
	admin.Post("/vod", h.VOD.Create)
	admin.Put("/vod/:id", h.VOD.Update)
	admin.Delete("/vod/:id", h.VOD.Delete)

	// Series
	admin.Get("/series", h.Series.List)
	admin.Post("/series/enrich", h.Series.EnrichWithTMDB)
	admin.Get("/series/:id", h.Series.GetByID)
	admin.Post("/series", h.Series.Create)
	admin.Put("/series/:id", h.Series.Update)
	admin.Delete("/series/:id", h.Series.Delete)

	// Users
	admin.Get("/users", h.User.List)
	admin.Get("/users/:id", h.User.GetByID)
	admin.Post("/users", h.User.Create)
	admin.Put("/users/:id", h.User.Update)
	admin.Delete("/users/:id", h.User.Delete)

	// Library Scanner
	admin.Get("/library/devices", h.LibraryScanner.ListDevices)
	// B12: Add rate limiting to library scan endpoint (1 request per 30 seconds)
	admin.Post("/library/scan", middleware.RateLimitLibraryScan(), h.LibraryScanner.Scan)
	admin.Get("/library/scan/:sessionId/status", h.LibraryScanner.GetScanStatus)
	admin.Get("/library/scan/:sessionId", h.LibraryScanner.GetResults)
	admin.Put("/library/scan/items/:id", h.LibraryScanner.UpdateItem)
	admin.Post("/library/import", h.LibraryScanner.Import)
	admin.Post("/library/tmdb/search", h.LibraryScanner.SearchTMDB)
	admin.Get("/library/tmdb/status", h.LibraryScanner.TMDBStatus)

	// IPTV Import
	admin.Post("/iptv/import", h.IPTV.Import)
	admin.Get("/iptv/status", h.IPTV.Status)
	admin.Delete("/iptv/channels", h.IPTV.DeleteBySource)

	// Tailscale (Docker container management)
	admin.Get("/tailscale/status", h.Tailscale.Status)
	admin.Post("/tailscale/start", h.Tailscale.Start)
	admin.Post("/tailscale/stop", h.Tailscale.Stop)
	admin.Post("/tailscale/restart", h.Tailscale.Restart)

	// EPG
	admin.Get("/epg", h.EPG.List)
	admin.Get("/epg/:id", h.EPG.GetByID)
	admin.Post("/epg", h.EPG.Create)
	admin.Put("/epg/:id", h.EPG.Update)
	admin.Delete("/epg/:id", h.EPG.Delete)

	// --- User routes (protegidas) ---
	user := v1.Group("/", middleware.AuthRequired(), middleware.RateLimitModerate()) // 60 req/min for authenticated users

	// Emisiones en vivo
	user.Get("/emissions/live", h.Emission.LiveChannels)

	// Busqueda global - relaxed limit
	user.Get("/search", middleware.RateLimitRelaxed(), h.Search.Search)

	// Catalogo - relaxed limit for read operations
	user.Get("/channels", middleware.RateLimitRelaxed(), h.Channel.ListActive)
	user.Get("/channels/:id", middleware.RateLimitRelaxed(), h.Channel.GetByID)
	user.Get("/vod", middleware.RateLimitRelaxed(), h.VOD.ListActive)
	user.Get("/vod/:id", middleware.RateLimitRelaxed(), h.VOD.GetByID)
	user.Get("/series", middleware.RateLimitRelaxed(), h.Series.ListActive)
	user.Get("/series/:id", middleware.RateLimitRelaxed(), h.Series.GetByID)
	user.Get("/series/:id/episodes", middleware.RateLimitRelaxed(), h.Series.GetEpisodes)
	user.Get("/categories", middleware.RateLimitRelaxed(), h.Category.ListByType)
	user.Get("/epg", middleware.RateLimitRelaxed(), h.EPG.ListByChannel)

	// Favoritos
	user.Get("/favorites", h.Favorite.List)
	user.Post("/favorites/toggle", h.Favorite.Toggle)

	// Historial
	user.Get("/history/continue", h.WatchHistory.ContinueWatching)
	user.Get("/history", h.WatchHistory.List)
	user.Post("/history", h.WatchHistory.Record)
	user.Delete("/history/:id", h.WatchHistory.Delete)

	// Perfil
	user.Put("/profile", h.Auth.UpdateProfile)
	user.Put("/profile/password", h.Auth.ChangePassword)
}
