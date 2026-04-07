package main

import (
	"fmt"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/cache"
	"github.com/tivify/backend/internal/config"
	"github.com/tivify/backend/internal/database"
	"github.com/tivify/backend/internal/handler"
	"github.com/tivify/backend/internal/repository"
	"github.com/tivify/backend/internal/router"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
	"github.com/tivify/backend/internal/ws"
)

func main() {
	// Inicializar structured logging (JSON)
	util.InitLogger()

	// Cargar configuracion
	cfg := config.Load()
	slog.Info("configuration loaded", "port", cfg.AppPort)

	// Inicializar JWT
	util.InitJWT(cfg.JWTSecret, cfg.JWTExpiry)

	// Conectar base de datos
	db := database.NewPostgres(cfg)

	// Conectar Redis
	rdb := database.NewRedis(cfg)

	// Inicializar cache
	cacheService := cache.NewCacheService(rdb)

	// Inicializar WebSocket hub
	wsHub := ws.NewHub()
	go wsHub.Run()

	// Ejecutar migraciones
	database.RunMigrations(db)

	// Crear directorios de media
	createMediaDirs(cfg.MediaPath)

	// Inicializar repositorios
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)
	channelRepo := repository.NewChannelRepository(db)
	streamRepo := repository.NewStreamRepository(db)
	vodRepo := repository.NewVODRepository(db)
	seriesRepo := repository.NewSeriesRepository(db)
	epgRepo := repository.NewEPGRepository(db)
	favoriteRepo := repository.NewFavoriteRepository(db)
	watchHistoryRepo := repository.NewWatchHistoryRepository(db)
	localMediaRepo := repository.NewLocalMediaRepository(db)
	playlistRepo := repository.NewPlaylistRepository(db)

	// Inicializar servicios
	authService := service.NewAuthService(userRepo, sessionRepo, cfg)
	userService := service.NewUserService(userRepo)
	categoryService := service.NewCategoryService(categoryRepo, cacheService)
	channelService := service.NewChannelService(channelRepo, streamRepo, db)
	tmdbService := service.NewTMDBService(cfg.TMDBAPIKey)
	// Validate TMDB API key on startup
	if tmdbService.IsConfigured() {
		if err := tmdbService.ValidateAPIKey(); err != nil {
			log.Printf("WARNING [TMDB] API key validation failed: %v", err)
		}
	} else {
		log.Println("WARNING [TMDB] No API key configured. Set TMDB_API_KEY in .env for metadata enrichment.")
		log.Println("WARNING [TMDB] Get a free API key at https://www.themoviedb.org/settings/api")
	}
	vodService := service.NewVODService(vodRepo, tmdbService)
	seriesService := service.NewSeriesService(seriesRepo, vodRepo, tmdbService)
	epgService := service.NewEPGService(epgRepo, channelRepo)
	favoriteService := service.NewFavoriteService(favoriteRepo, channelRepo, vodRepo, seriesRepo)
	watchHistoryService := service.NewWatchHistoryService(watchHistoryRepo, channelRepo, vodRepo)
	// B19: Pass ffprobePath to transcoder service
	transcoderService := service.NewTranscoderService(localMediaRepo, cfg.FFmpegPath, cfg.FFprobePath, cfg.MediaPath)
	transcoderService.SetHub(wsHub)
	localMediaService := service.NewLocalMediaService(localMediaRepo, transcoderService, vodService, cfg.MediaPath)
	playlistService := service.NewPlaylistService(playlistRepo, localMediaRepo, channelRepo, streamRepo, cfg.MediaPath)
	libraryScannerRepo := repository.NewLibraryScannerRepository(db)
	emissionRepo := repository.NewEmissionRepository(db)
	emissionService := service.NewEmissionService(emissionRepo, streamRepo, cfg.FFmpegPath, cfg.MediaPath)
	emissionService.SetHub(wsHub)
	libraryScannerService := service.NewLibraryScannerService(
		libraryScannerRepo, transcoderService, tmdbService,
		vodRepo, seriesRepo, categoryRepo, cfg.LibraryPath, cfg.MediaPath,
	)
	libraryScannerService.SetHub(wsHub)

	// IPTV Seeder (instancia compartida entre startup y panel admin)
	iptvSeeder := service.NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Seed admin
	authService.SeedAdmin()

	// Seed IPTV inicial: solo si la BD está vacía y SEED_IPTV=true
	if cfg.SeedIPTV {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("ERROR [PANIC] IPTV seed goroutine: %v", r)
				}
			}()
			log.Println("INFO [IPTV-SEED] Starting IPTV seed from URL...")
			iptvSeeder.SeedFromURL(cfg.IPTVm3uURL)
		}()
	}

	// Resume any pending transcodes from previous runs
	if err := func() error {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("ERROR [PANIC] Resume pending transcodes: %v", r)
			}
		}()
		transcoderService.ResumePendingTranscodes()
		return nil
	}(); err != nil {
		log.Printf("ERROR [STARTUP] Failed to resume pending transcodes: %v", err)
	}

	// Limpiar emisiones huerfanas de ejecuciones anteriores
	if err := func() error {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("ERROR [PANIC] Emission cleanup on startup: %v", r)
			}
		}()
		emissionService.CleanupOnStartup()
		return nil
	}(); err != nil {
		log.Printf("ERROR [STARTUP] Failed to cleanup orphaned emissions: %v", err)
	}

	// Inicializar handlers
	authHandler := handler.NewAuthHandler(authService, userService, cfg)
	categoryHandler := handler.NewCategoryHandler(categoryService)
	channelHandler := handler.NewChannelHandler(channelService)
	vodHandler := handler.NewVODHandler(vodService)
	seriesHandler := handler.NewSeriesHandler(seriesService)
	userHandler := handler.NewUserHandler(userService)
	epgHandler := handler.NewEPGHandler(epgService)
	favoriteHandler := handler.NewFavoriteHandler(favoriteService)
	watchHistoryHandler := handler.NewWatchHistoryHandler(watchHistoryService)
	dashboardHandler := handler.NewDashboardHandler(channelService, vodService, seriesService, userService, vodRepo, userRepo, cacheService)
	localMediaHandler := handler.NewLocalMediaHandler(localMediaService, vodService)
	playlistHandler := handler.NewPlaylistHandler(playlistService)
	emissionHandler := handler.NewEmissionHandler(emissionService)
	libraryScannerHandler := handler.NewLibraryScannerHandler(libraryScannerService)
	iptvHandler := handler.NewIPTVHandler(iptvSeeder, channelRepo)
	searchHandler := handler.NewSearchHandler(channelService, vodService, seriesService)
	tailscaleHandler := handler.NewTailscaleHandler()

	// Crear app Fiber
	app := fiber.New(fiber.Config{
		BodyLimit:    50 * 1024 * 1024, // 50MB default body limit (upload endpoints can override)
		ServerHeader: "",
		ReadTimeout:  30 * time.Second,  // 30s read timeout
		WriteTimeout: 60 * time.Second,  // 60s write timeout
		IdleTimeout:  30 * time.Second,  // 30s idle timeout
	})

	// Configurar rutas
	handlers := &router.Handlers{
		Auth:           authHandler,
		Category:       categoryHandler,
		Channel:        channelHandler,
		VOD:            vodHandler,
		Series:         seriesHandler,
		User:           userHandler,
		EPG:            epgHandler,
		Favorite:       favoriteHandler,
		WatchHistory:   watchHistoryHandler,
		Dashboard:      dashboardHandler,
		LocalMedia:     localMediaHandler,
		Playlist:       playlistHandler,
		Emission:       emissionHandler,
		LibraryScanner: libraryScannerHandler,
		IPTV:           iptvHandler,
		Search:         searchHandler,
		Tailscale:      tailscaleHandler,
	}
	// CORS origin: preferir variable explícita, fallback a BaseURL
	corsOrigin := cfg.CORSAllowOrigins
	if corsOrigin == "" {
		corsOrigin = cfg.BaseURL
	}
	healthDeps := &router.HealthDeps{DB: db, Redis: rdb}
	router.Setup(app, handlers, corsOrigin, healthDeps, wsHub)

	// Limpieza periodica de sesiones expiradas
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("ERROR [PANIC] Session cleanup goroutine: %v", r)
			}
		}()
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if err := sessionRepo.DeleteExpired(); err != nil {
				log.Printf("ERROR [SESSION-CLEANUP] Failed to clean expired sessions: %v", err)
			} else {
				log.Println("INFO [SESSION-CLEANUP] Expired sessions cleaned successfully")
			}
		}
	}()

	// Graceful shutdown
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("ERROR [PANIC] Graceful shutdown goroutine: %v", r)
			}
		}()
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		log.Println("INFO [SHUTDOWN] Server shutdown initiated...")
		emissionService.StopAll()
		rdb.Close()
		app.Shutdown()
	}()

	// Iniciar servidor
	addr := fmt.Sprintf(":%s", cfg.AppPort)
	log.Printf("TIVIFY Backend iniciado en %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("Error iniciando servidor: %v", err)
	}
}

func createMediaDirs(basePath string) {
	dirs := []string{
		basePath + "/uploads",
		basePath + "/vod",
		basePath + "/thumbnails",
		basePath + "/logos",
		basePath + "/local",
		basePath + "/channels",
		basePath + "/live",
	}
	for _, dir := range dirs {
		os.MkdirAll(dir, 0755)
	}
}
