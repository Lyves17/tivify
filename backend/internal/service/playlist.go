package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type PlaylistService struct {
	playlistRepo PlaylistRepositoryInterface
	mediaRepo    LocalMediaRepositoryInterface
	channelRepo  ChannelRepositoryInterface
	streamRepo   StreamRepositoryInterface
	mediaPath    string
}

func NewPlaylistService(
	playlistRepo PlaylistRepositoryInterface,
	mediaRepo LocalMediaRepositoryInterface,
	channelRepo ChannelRepositoryInterface,
	streamRepo StreamRepositoryInterface,
	mediaPath string,
) *PlaylistService {
	return &PlaylistService{
		playlistRepo: playlistRepo,
		mediaRepo:    mediaRepo,
		channelRepo:  channelRepo,
		streamRepo:   streamRepo,
		mediaPath:    mediaPath,
	}
}

func (s *PlaylistService) GetByChannelID(channelID uint) (*dto.PlaylistResponse, error) {
	playlist, err := s.playlistRepo.FindByChannelID(channelID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create a new playlist for this channel
			playlist = &model.Playlist{
				ChannelID:    channelID,
				PlaybackMode: "loop",
				IsActive:     true,
			}
			if err := s.playlistRepo.Create(playlist); err != nil {
				return nil, err
			}
			playlist.Items = []model.PlaylistItem{}
		} else {
			return nil, err
		}
	}
	return toPlaylistResponse(playlist), nil
}

func (s *PlaylistService) AddItem(channelID uint, req dto.AddPlaylistItemRequest) (*dto.PlaylistResponse, error) {
	// Verify media exists and is completed
	media, err := s.mediaRepo.FindByID(req.LocalMediaID)
	if err != nil {
		return nil, fmt.Errorf("media no encontrada")
	}
	if media.Status != "completed" {
		return nil, fmt.Errorf("el archivo aun no ha terminado de transcodificar")
	}

	// Ensure playlist exists
	playlist, err := s.playlistRepo.FindByChannelID(channelID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			playlist = &model.Playlist{
				ChannelID:    channelID,
				PlaybackMode: "loop",
				IsActive:     true,
			}
			if err := s.playlistRepo.Create(playlist); err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	item := &model.PlaylistItem{
		PlaylistID:   playlist.ID,
		LocalMediaID: req.LocalMediaID,
		SortOrder:    req.SortOrder,
	}

	if err := s.playlistRepo.AddItem(item); err != nil {
		return nil, err
	}

	return s.GetByChannelID(channelID)
}

func (s *PlaylistService) RemoveItem(channelID, itemID uint) (*dto.PlaylistResponse, error) {
	// Verify item belongs to this channel's playlist
	playlist, err := s.playlistRepo.FindByChannelID(channelID)
	if err != nil {
		return nil, err
	}

	found := false
	for _, item := range playlist.Items {
		if item.ID == itemID {
			found = true
			break
		}
	}
	if !found {
		return nil, fmt.Errorf("item no pertenece a esta playlist")
	}

	if err := s.playlistRepo.RemoveItem(itemID); err != nil {
		return nil, err
	}

	return s.GetByChannelID(channelID)
}

func (s *PlaylistService) Reorder(channelID uint, req dto.ReorderPlaylistRequest) (*dto.PlaylistResponse, error) {
	playlist, err := s.playlistRepo.FindByChannelID(channelID)
	if err != nil {
		return nil, err
	}

	items := make([]struct {
		ID        uint
		SortOrder int
	}, len(req.Items))
	for i, item := range req.Items {
		items[i] = struct {
			ID        uint
			SortOrder int
		}{ID: item.ID, SortOrder: item.SortOrder}
	}

	if err := s.playlistRepo.ReorderItems(playlist.ID, items); err != nil {
		return nil, err
	}

	return s.GetByChannelID(channelID)
}

func (s *PlaylistService) UpdateMode(channelID uint, req dto.UpdatePlaylistModeRequest) (*dto.PlaylistResponse, error) {
	validModes := map[string]bool{"loop": true, "once": true, "shuffle": true}
	if !validModes[req.PlaybackMode] {
		return nil, fmt.Errorf("modo no valido: %s", req.PlaybackMode)
	}

	playlist, err := s.playlistRepo.FindByChannelID(channelID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			playlist = &model.Playlist{
				ChannelID:    channelID,
				PlaybackMode: req.PlaybackMode,
				IsActive:     true,
			}
			if err := s.playlistRepo.Create(playlist); err != nil {
				return nil, err
			}
			return toPlaylistResponse(playlist), nil
		}
		return nil, err
	}

	playlist.PlaybackMode = req.PlaybackMode
	if err := s.playlistRepo.Update(playlist); err != nil {
		return nil, err
	}

	return s.GetByChannelID(channelID)
}

// GenerateMasterPlaylist creates a concatenated HLS playlist from all items
func (s *PlaylistService) GenerateMasterPlaylist(channelID uint) (*dto.PlaylistResponse, error) {
	playlist, err := s.playlistRepo.FindByChannelID(channelID)
	if err != nil {
		return nil, err
	}

	if len(playlist.Items) == 0 {
		return nil, fmt.Errorf("la playlist no tiene items")
	}

	// Verify all items are transcoded
	for _, item := range playlist.Items {
		if item.LocalMedia == nil {
			return nil, fmt.Errorf("el archivo de playlist item %d no fue encontrado", item.ID)
		}
		if item.LocalMedia.Status != "completed" {
			return nil, fmt.Errorf("el archivo '%s' aun no esta listo", item.LocalMedia.OriginalFilename)
		}
	}

	// Create output directory
	outputDir := filepath.Join(s.mediaPath, "channels", fmt.Sprintf("%d", channelID))
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("error creando directorio de canal: %w", err)
	}

	// First pass: collect all segments and compute max target duration
	type segmentEntry struct {
		mediaID uint
		lines   []string // pairs of #EXTINF + segment filename
	}
	var allSegments []segmentEntry
	maxTargetDuration := 0

	for _, item := range playlist.Items {
		media := item.LocalMedia
		hlsDir := filepath.Join(s.mediaPath, "local", fmt.Sprintf("%d", media.ID))

		indexPath := filepath.Join(hlsDir, "index.m3u8")
		content, err := os.ReadFile(indexPath)
		if err != nil {
			return nil, fmt.Errorf("error leyendo playlist de %s: %w", media.OriginalFilename, err)
		}

		entry := segmentEntry{mediaID: media.ID}
		lines := strings.Split(string(content), "\n")

		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#EXTM3U") ||
				strings.HasPrefix(line, "#EXT-X-VERSION") ||
				strings.HasPrefix(line, "#EXT-X-MEDIA-SEQUENCE") ||
				strings.HasPrefix(line, "#EXT-X-ENDLIST") {
				continue
			}

			// Parse TARGETDURATION from source
			if strings.HasPrefix(line, "#EXT-X-TARGETDURATION:") {
				durStr := strings.TrimPrefix(line, "#EXT-X-TARGETDURATION:")
				if dur, err := strconv.Atoi(strings.TrimSpace(durStr)); err == nil {
					if dur > maxTargetDuration {
						maxTargetDuration = dur
					}
				}
				continue
			}

			if strings.HasPrefix(line, "#") {
				entry.lines = append(entry.lines, line)
			} else {
				// Rewrite segment filename to absolute path
				segmentURL := fmt.Sprintf("/media/local/%d/%s", media.ID, line)
				entry.lines = append(entry.lines, segmentURL)
			}
		}
		allSegments = append(allSegments, entry)
	}

	if maxTargetDuration == 0 {
		maxTargetDuration = 10
	}

	// Build the concatenated m3u8 playlist
	var builder strings.Builder
	builder.WriteString("#EXTM3U\n")
	builder.WriteString("#EXT-X-VERSION:3\n")
	builder.WriteString(fmt.Sprintf("#EXT-X-TARGETDURATION:%d\n", maxTargetDuration))
	builder.WriteString("#EXT-X-MEDIA-SEQUENCE:0\n")

	for i, entry := range allSegments {
		for _, line := range entry.lines {
			builder.WriteString(line + "\n")
		}
		// Add discontinuity between items (not after the last one)
		if i < len(allSegments)-1 {
			builder.WriteString("#EXT-X-DISCONTINUITY\n")
		}
	}

	builder.WriteString("#EXT-X-ENDLIST\n")

	// Write the master playlist
	masterPath := filepath.Join(outputDir, "playlist.m3u8")
	if err := os.WriteFile(masterPath, []byte(builder.String()), 0644); err != nil {
		return nil, fmt.Errorf("error escribiendo playlist: %w", err)
	}

	// Create or update stream in the channel pointing to this playlist
	streamURL := fmt.Sprintf("/media/channels/%d/playlist.m3u8", channelID)

	// Check if a local-emission stream already exists
	streams, err := s.streamRepo.ListByChannel(channelID)
	if err != nil {
		return nil, fmt.Errorf("error listando streams del canal: %w", err)
	}
	var localStream *model.Stream
	for i, st := range streams {
		if strings.Contains(st.URL, "/media/channels/") {
			localStream = &streams[i]
			break
		}
	}

	if localStream != nil {
		localStream.URL = streamURL
		localStream.StreamFormat = "hls"
		localStream.IsActive = true
		if err := s.streamRepo.Update(localStream); err != nil {
			return nil, fmt.Errorf("error actualizando stream: %w", err)
		}
	} else {
		newStream := &model.Stream{
			ChannelID:    channelID,
			URL:          streamURL,
			StreamFormat: "hls",
			Priority:     100,
			IsActive:     true,
			Headers:      "{}",
		}
		if err := s.streamRepo.Create(newStream); err != nil {
			return nil, fmt.Errorf("error creando stream: %w", err)
		}
	}

	return s.GetByChannelID(channelID)
}

func toPlaylistResponse(p *model.Playlist) *dto.PlaylistResponse {
	items := make([]dto.PlaylistItemResponse, len(p.Items))
	for i, item := range p.Items {
		items[i] = dto.PlaylistItemResponse{
			ID:           item.ID,
			LocalMediaID: item.LocalMediaID,
			SortOrder:    item.SortOrder,
			CreatedAt:    item.CreatedAt,
		}
		if item.LocalMedia != nil {
			items[i].LocalMedia = toLocalMediaResponse(item.LocalMedia)
		}
	}

	return &dto.PlaylistResponse{
		ID:           p.ID,
		ChannelID:    p.ChannelID,
		PlaybackMode: p.PlaybackMode,
		IsActive:     p.IsActive,
		Items:        items,
		CreatedAt:    p.CreatedAt,
	}
}
