package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type DashboardHandler struct {
	channelService *service.ChannelService
	vodService     *service.VODService
	seriesService  *service.SeriesService
	userService    *service.UserService
	vodRepo        service.VODRepositoryInterface
	userRepo       service.FullUserRepository
	cache          service.CacheServiceInterface
}

func NewDashboardHandler(
	channelService *service.ChannelService,
	vodService *service.VODService,
	seriesService *service.SeriesService,
	userService *service.UserService,
	vodRepo service.VODRepositoryInterface,
	userRepo service.FullUserRepository,
	cacheService service.CacheServiceInterface,
) *DashboardHandler {
	return &DashboardHandler{
		channelService: channelService,
		vodService:     vodService,
		seriesService:  seriesService,
		userService:    userService,
		vodRepo:        vodRepo,
		userRepo:       userRepo,
		cache:          cacheService,
	}
}

type dashboardCounts struct {
	Channels int64 `json:"channels"`
	VODs     int64 `json:"vods"`
	Series   int64 `json:"series"`
	Users    int64 `json:"users"`
}

func (h *DashboardHandler) Stats(c *fiber.Ctx) error {
	// Cached counters (1 minute TTL)
	var counts dashboardCounts
	if h.cache == nil || !h.cache.Get("dashboard:counts", &counts) {
		counts.Channels, _ = h.channelService.CountActive()
		counts.VODs, _ = h.vodService.CountActive()
		counts.Series, _ = h.seriesService.CountActive()
		counts.Users, _ = h.userService.Count()
		if h.cache != nil {
			h.cache.Set("dashboard:counts", counts, 1*time.Minute)
		}
	}

	// Recent VODs (not cached — volatile)
	recentVODs, _ := h.vodRepo.ListRecent(10)
	var recentVODItems []fiber.Map
	for _, v := range recentVODs {
		recentVODItems = append(recentVODItems, fiber.Map{
			"id":                 v.ID,
			"title":              v.Title,
			"transcode_status":   v.TranscodeStatus,
			"transcode_progress": v.TranscodeProgress,
			"created_at":         v.CreatedAt,
		})
	}

	// Problem VODs (not cached — volatile)
	problemVODs, _ := h.vodRepo.ListByTranscodeStatus([]string{"pending", "processing", "failed"})
	var problemVODItems []fiber.Map
	for _, v := range problemVODs {
		problemVODItems = append(problemVODItems, fiber.Map{
			"id":                 v.ID,
			"title":              v.Title,
			"transcode_status":   v.TranscodeStatus,
			"transcode_progress": v.TranscodeProgress,
		})
	}

	// Recent users (not cached — volatile)
	recentUsers, _ := h.userRepo.ListRecent(10)
	var recentUserItems []fiber.Map
	for _, u := range recentUsers {
		recentUserItems = append(recentUserItems, fiber.Map{
			"id":         u.ID,
			"username":   u.Username,
			"role":       u.Role,
			"created_at": u.CreatedAt,
		})
	}

	return util.Success(c, fiber.Map{
		"channels":     counts.Channels,
		"vods":         counts.VODs,
		"series":       counts.Series,
		"users":        counts.Users,
		"recent_vods":  recentVODItems,
		"problem_vods": problemVODItems,
		"recent_users": recentUserItems,
	})
}
