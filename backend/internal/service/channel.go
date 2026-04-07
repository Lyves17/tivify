package service

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/util"
	"gorm.io/gorm"
)

// B20: TODO: Add context.Context parameter to all service methods for proper cancellation support
// This would enable cancellation of long-running operations like bulk imports.
// Recommendation: Start with methods that perform database operations and work outward.

type ChannelService struct {
	channelRepo ChannelRepositoryInterface
	streamRepo  StreamRepositoryInterface
	db          *gorm.DB
}

func NewChannelService(channelRepo ChannelRepositoryInterface, streamRepo StreamRepositoryInterface, db *gorm.DB) *ChannelService {
	return &ChannelService{
		channelRepo: channelRepo,
		streamRepo:  streamRepo,
		db:          db,
	}
}

func (s *ChannelService) List(page, perPage int) ([]dto.ChannelListResponse, int64, error) {
	channels, total, err := s.channelRepo.List(page, perPage)
	if err != nil {
		return nil, 0, err
	}
	var result []dto.ChannelListResponse
	for _, ch := range channels {
		result = append(result, toChannelListResponse(ch))
	}
	return result, total, nil
}

func (s *ChannelService) ListActive(page, perPage int, search string, categoryID *uint) ([]dto.ChannelListResponse, int64, error) {
	channels, total, err := s.channelRepo.ListActive(page, perPage, search, categoryID)
	if err != nil {
		return nil, 0, err
	}
	var result []dto.ChannelListResponse
	for _, ch := range channels {
		result = append(result, toChannelListResponse(ch))
	}
	return result, total, nil
}

func (s *ChannelService) GetByID(id uint) (*dto.ChannelResponse, error) {
	channel, err := s.channelRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("canal no encontrado")
	}
	resp := toChannelResponse(*channel)
	return &resp, nil
}

func (s *ChannelService) Create(req dto.CreateChannelRequest) (*dto.ChannelResponse, error) {
	if req.Name == "" {
		return nil, errors.New("nombre es requerido")
	}

	slug := req.Slug
	if slug == "" {
		slug = generateSlug(req.Name)
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var channelID uint

	// Transacción atómica: canal + streams
	err := s.db.Transaction(func(tx *gorm.DB) error {
		channel := &model.Channel{
			Name:          req.Name,
			Slug:          slug,
			CategoryID:    req.CategoryID,
			LogoURL:       req.LogoURL,
			EPGChannelID:  req.EPGChannelID,
			ChannelNumber: req.ChannelNumber,
			IsActive:      isActive,
		}

		if err := tx.Create(channel).Error; err != nil {
			return fmt.Errorf("error creando canal: %w", err)
		}
		channelID = channel.ID

		for _, streamReq := range req.Streams {
			// B1: Validate stream URL
			if err := util.ValidateStreamURL(streamReq.URL); err != nil {
				return fmt.Errorf("URL de stream invalida: %w", err)
			}

			// B2: Validate headers JSON and size
			if streamReq.Headers != "" {
				if len(streamReq.Headers) > util.MaxHeadersLength {
					return fmt.Errorf("headers exceden el limite de %d caracteres", util.MaxHeadersLength)
				}
				var headerMap map[string]interface{}
				if err := json.Unmarshal([]byte(streamReq.Headers), &headerMap); err != nil {
					return errors.New("headers no es un JSON valido")
				}
			}

			streamActive := true
			if streamReq.IsActive != nil {
				streamActive = *streamReq.IsActive
			}
			stream := &model.Stream{
				ChannelID:    channel.ID,
				URL:          streamReq.URL,
				StreamFormat: streamReq.StreamFormat,
				Priority:     streamReq.Priority,
				IsActive:     streamActive,
				UserAgent:    streamReq.UserAgent,
				Headers:      streamReq.Headers,
			}
			if err := tx.Create(stream).Error; err != nil {
				return fmt.Errorf("error creando stream: %w", err)
			}
		}
		return nil
	})

	if err != nil {
		return nil, errors.New("error creando canal con streams")
	}

	return s.GetByID(channelID)
}

func (s *ChannelService) Update(id uint, req dto.UpdateChannelRequest) (*dto.ChannelResponse, error) {
	channel, err := s.channelRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("canal no encontrado")
	}

	if req.Name != "" {
		channel.Name = req.Name
	}
	if req.Slug != "" {
		channel.Slug = req.Slug
	}
	channel.CategoryID = req.CategoryID
	if req.LogoURL != "" {
		channel.LogoURL = req.LogoURL
	}
	channel.EPGChannelID = req.EPGChannelID
	channel.ChannelNumber = req.ChannelNumber
	if req.IsActive != nil {
		channel.IsActive = *req.IsActive
	}

	if err := s.channelRepo.Update(channel); err != nil {
		return nil, errors.New("error actualizando canal")
	}

	return s.GetByID(channel.ID)
}

func (s *ChannelService) Delete(id uint) error {
	return s.channelRepo.Delete(id)
}

func (s *ChannelService) AddStream(channelID uint, req dto.CreateStreamRequest) (*dto.StreamResponse, error) {
	if _, err := s.channelRepo.FindByID(channelID); err != nil {
		return nil, errors.New("canal no encontrado")
	}

	if req.URL == "" {
		return nil, errors.New("URL es requerida")
	}

	// B1: Validate stream URL against SSRF attacks
	if err := util.ValidateStreamURL(req.URL); err != nil {
		return nil, fmt.Errorf("URL de stream invalida: %w", err)
	}

	// B2: Validate headers JSON and size
	if req.Headers != "" {
		if len(req.Headers) > util.MaxHeadersLength {
			return nil, fmt.Errorf("headers exceden el limite de %d caracteres", util.MaxHeadersLength)
		}
		var headerMap map[string]interface{}
		if err := json.Unmarshal([]byte(req.Headers), &headerMap); err != nil {
			return nil, errors.New("headers no es un JSON valido")
		}
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	stream := &model.Stream{
		ChannelID:    channelID,
		URL:          req.URL,
		StreamFormat: req.StreamFormat,
		Priority:     req.Priority,
		IsActive:     isActive,
		UserAgent:    req.UserAgent,
		Headers:      req.Headers,
	}

	if err := s.streamRepo.Create(stream); err != nil {
		return nil, errors.New("error creando stream")
	}

	resp := toStreamResponse(*stream)
	return &resp, nil
}

func (s *ChannelService) UpdateStream(streamID uint, req dto.UpdateStreamRequest) (*dto.StreamResponse, error) {
	stream, err := s.streamRepo.FindByID(streamID)
	if err != nil {
		return nil, errors.New("stream no encontrado")
	}

	if req.URL != "" {
		// B1: Validate stream URL against SSRF attacks
		if err := util.ValidateStreamURL(req.URL); err != nil {
			return nil, fmt.Errorf("URL de stream invalida: %w", err)
		}
		stream.URL = req.URL
	}
	if req.StreamFormat != "" {
		stream.StreamFormat = req.StreamFormat
	}
	if req.Priority != nil {
		stream.Priority = *req.Priority
	}
	if req.IsActive != nil {
		stream.IsActive = *req.IsActive
	}
	stream.UserAgent = req.UserAgent

	// B2: Validate headers JSON and size if provided
	if req.Headers != "" {
		if len(req.Headers) > util.MaxHeadersLength {
			return nil, fmt.Errorf("headers exceden el limite de %d caracteres", util.MaxHeadersLength)
		}
		var headerMap map[string]interface{}
		if err := json.Unmarshal([]byte(req.Headers), &headerMap); err != nil {
			return nil, errors.New("headers no es un JSON valido")
		}
		stream.Headers = req.Headers
	}

	if err := s.streamRepo.Update(stream); err != nil {
		return nil, errors.New("error actualizando stream")
	}

	resp := toStreamResponse(*stream)
	return &resp, nil
}

func (s *ChannelService) DeleteStream(streamID uint) error {
	return s.streamRepo.Delete(streamID)
}

func (s *ChannelService) CountActive() (int64, error) {
	return s.channelRepo.CountActive()
}

func toChannelResponse(ch model.Channel) dto.ChannelResponse {
	resp := dto.ChannelResponse{
		ID:            ch.ID,
		Name:          ch.Name,
		Slug:          ch.Slug,
		CategoryID:    ch.CategoryID,
		LogoURL:       ch.LogoURL,
		EPGChannelID:  ch.EPGChannelID,
		ChannelNumber: ch.ChannelNumber,
		IsActive:      ch.IsActive,
		CreatedAt:     ch.CreatedAt,
	}
	if ch.Category != nil {
		cat := toCategoryResponse(*ch.Category)
		resp.Category = &cat
	}
	for _, s := range ch.Streams {
		resp.Streams = append(resp.Streams, toStreamResponse(s))
	}
	return resp
}

func toChannelListResponse(ch model.Channel) dto.ChannelListResponse {
	resp := dto.ChannelListResponse{
		ID:            ch.ID,
		Name:          ch.Name,
		Slug:          ch.Slug,
		CategoryID:    ch.CategoryID,
		LogoURL:       ch.LogoURL,
		EPGChannelID:  ch.EPGChannelID,
		ChannelNumber: ch.ChannelNumber,
		IsActive:      ch.IsActive,
		StreamCount:   len(ch.Streams),
		CreatedAt:     ch.CreatedAt,
	}
	if ch.Category != nil {
		cat := toCategoryResponse(*ch.Category)
		resp.Category = &cat
	}
	return resp
}

func toStreamResponse(s model.Stream) dto.StreamResponse {
	return dto.StreamResponse{
		ID:           s.ID,
		ChannelID:    s.ChannelID,
		URL:          s.URL,
		StreamFormat: s.StreamFormat,
		Priority:     s.Priority,
		IsActive:     s.IsActive,
		UserAgent:    s.UserAgent,
		Headers:      s.Headers,
		CreatedAt:    s.CreatedAt,
	}
}
