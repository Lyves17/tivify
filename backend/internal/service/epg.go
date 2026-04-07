package service

import (
	"errors"
	"time"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
)

type EPGService struct {
	epgRepo     EPGRepositoryInterface
	channelRepo ChannelRepositoryInterface
}

func NewEPGService(epgRepo EPGRepositoryInterface, channelRepo ChannelRepositoryInterface) *EPGService {
	return &EPGService{
		epgRepo:     epgRepo,
		channelRepo: channelRepo,
	}
}

func (s *EPGService) List(page, perPage int) ([]dto.EPGResponse, int64, error) {
	entries, total, err := s.epgRepo.List(page, perPage)
	if err != nil {
		return nil, 0, err
	}
	var result []dto.EPGResponse
	for _, e := range entries {
		result = append(result, toEPGResponse(e))
	}
	return result, total, nil
}

func (s *EPGService) ListByChannel(channelID uint, dateStr string) ([]dto.EPGResponse, error) {
	date := time.Now()
	if dateStr != "" {
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			date = parsed
		}
	}

	entries, err := s.epgRepo.ListByChannel(channelID, date)
	if err != nil {
		return nil, err
	}
	var result []dto.EPGResponse
	for _, e := range entries {
		result = append(result, toEPGResponse(e))
	}
	return result, nil
}

func (s *EPGService) GetByID(id uint) (*dto.EPGResponse, error) {
	entry, err := s.epgRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("entrada EPG no encontrada")
	}
	resp := toEPGResponse(*entry)
	return &resp, nil
}

func (s *EPGService) Create(req dto.CreateEPGRequest) (*dto.EPGResponse, error) {
	if req.Title == "" {
		return nil, errors.New("titulo es requerido")
	}
	if req.ChannelID == 0 {
		return nil, errors.New("canal es requerido")
	}

	if _, err := s.channelRepo.FindByID(req.ChannelID); err != nil {
		return nil, errors.New("canal no encontrado")
	}

	entry := &model.EPGEntry{
		ChannelID:   req.ChannelID,
		Title:       req.Title,
		Description: req.Description,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Category:    req.Category,
		Language:    req.Language,
		EpisodeNum:  req.EpisodeNum,
	}

	if err := s.epgRepo.Create(entry); err != nil {
		return nil, errors.New("error creando entrada EPG")
	}

	return s.GetByID(entry.ID)
}

func (s *EPGService) Update(id uint, req dto.UpdateEPGRequest) (*dto.EPGResponse, error) {
	entry, err := s.epgRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("entrada EPG no encontrada")
	}

	if req.ChannelID != nil {
		entry.ChannelID = *req.ChannelID
	}
	if req.Title != "" {
		entry.Title = req.Title
	}
	if req.Description != "" {
		entry.Description = req.Description
	}
	if req.StartTime != nil {
		entry.StartTime = *req.StartTime
	}
	if req.EndTime != nil {
		entry.EndTime = *req.EndTime
	}
	if req.Category != "" {
		entry.Category = req.Category
	}
	entry.Language = req.Language
	entry.EpisodeNum = req.EpisodeNum

	if err := s.epgRepo.Update(entry); err != nil {
		return nil, errors.New("error actualizando entrada EPG")
	}

	return s.GetByID(entry.ID)
}

func (s *EPGService) Delete(id uint) error {
	return s.epgRepo.Delete(id)
}

func toEPGResponse(e model.EPGEntry) dto.EPGResponse {
	resp := dto.EPGResponse{
		ID:          e.ID,
		ChannelID:   e.ChannelID,
		Title:       e.Title,
		Description: e.Description,
		StartTime:   e.StartTime,
		EndTime:     e.EndTime,
		Category:    e.Category,
		Language:    e.Language,
		EpisodeNum:  e.EpisodeNum,
		CreatedAt:   e.CreatedAt,
	}
	if e.Channel != nil {
		resp.ChannelName = e.Channel.Name
	}
	return resp
}
