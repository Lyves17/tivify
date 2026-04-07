package handler

import (
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type SearchHandler struct {
	channelService *service.ChannelService
	vodService     *service.VODService
	seriesService  *service.SeriesService
}

func NewSearchHandler(
	channelService *service.ChannelService,
	vodService *service.VODService,
	seriesService *service.SeriesService,
) *SearchHandler {
	return &SearchHandler{
		channelService: channelService,
		vodService:     vodService,
		seriesService:  seriesService,
	}
}

func (h *SearchHandler) Search(c *fiber.Ctx) error {
	q := c.Query("q")
	if len(q) > util.MaxSearchLength {
		q = q[:util.MaxSearchLength]
	}
	if q == "" {
		return util.Success(c, fiber.Map{
			"channels": []interface{}{},
			"vods":     []interface{}{},
			"series":   []interface{}{},
		})
	}

	var wg sync.WaitGroup
	wg.Add(3)

	var channels interface{}
	var vods interface{}
	var series interface{}

	go func() {
		defer wg.Done()
		if result, _, err := h.channelService.ListActive(1, 10, q, nil); err == nil && result != nil {
			channels = result
		} else {
			channels = []interface{}{}
		}
	}()

	go func() {
		defer wg.Done()
		if result, _, err := h.vodService.ListActive(1, 10, q, nil); err == nil && result != nil {
			vods = result
		} else {
			vods = []interface{}{}
		}
	}()

	go func() {
		defer wg.Done()
		if result, _, err := h.seriesService.ListActive(1, 10, q, nil); err == nil && result != nil {
			series = result
		} else {
			series = []interface{}{}
		}
	}()

	wg.Wait()

	return util.Success(c, fiber.Map{
		"channels": channels,
		"vods":     vods,
		"series":   series,
	})
}
