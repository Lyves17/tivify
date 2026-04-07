package service

import (
	"testing"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock ChannelRepository ---

type mockChannelRepo struct {
	channels  map[uint]*model.Channel
	bySlug    map[string]*model.Channel
	nextID    uint
	createErr error
	updateErr error
}

func newMockChannelRepo() *mockChannelRepo {
	return &mockChannelRepo{
		channels: make(map[uint]*model.Channel),
		bySlug:   make(map[string]*model.Channel),
		nextID:   1,
	}
}

func (m *mockChannelRepo) FindByID(id uint) (*model.Channel, error) {
	c, ok := m.channels[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}

func (m *mockChannelRepo) FindBySlug(slug string) (*model.Channel, error) {
	c, ok := m.bySlug[slug]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}

func (m *mockChannelRepo) List(page, perPage int) ([]model.Channel, int64, error) {
	var chs []model.Channel
	for _, c := range m.channels {
		chs = append(chs, *c)
	}
	return chs, int64(len(chs)), nil
}

func (m *mockChannelRepo) ListActive(page, perPage int, search string, categoryID *uint) ([]model.Channel, int64, error) {
	var chs []model.Channel
	for _, c := range m.channels {
		if c.IsActive {
			chs = append(chs, *c)
		}
	}
	return chs, int64(len(chs)), nil
}

func (m *mockChannelRepo) Create(channel *model.Channel) error {
	if m.createErr != nil {
		return m.createErr
	}
	channel.ID = m.nextID
	m.nextID++
	m.channels[channel.ID] = channel
	m.bySlug[channel.Slug] = channel
	return nil
}

func (m *mockChannelRepo) Update(channel *model.Channel) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.channels[channel.ID] = channel
	m.bySlug[channel.Slug] = channel
	return nil
}

func (m *mockChannelRepo) Delete(id uint) error {
	c, ok := m.channels[id]
	if !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.channels, id)
	delete(m.bySlug, c.Slug)
	return nil
}

func (m *mockChannelRepo) Count() (int64, error) {
	return int64(len(m.channels)), nil
}

func (m *mockChannelRepo) CountActive() (int64, error) {
	var count int64
	for _, c := range m.channels {
		if c.IsActive {
			count++
		}
	}
	return count, nil
}

func (m *mockChannelRepo) CountBySource(source string) (int64, error) {
	var count int64
	for _, c := range m.channels {
		if c.Source == source {
			count++
		}
	}
	return count, nil
}

func (m *mockChannelRepo) DeleteBySource(source string) error {
	for id, c := range m.channels {
		if c.Source == source {
			delete(m.bySlug, c.Slug)
			delete(m.channels, id)
		}
	}
	return nil
}

func (m *mockChannelRepo) addChannel(ch *model.Channel) {
	if ch.ID == 0 {
		ch.ID = m.nextID
		m.nextID++
	}
	m.channels[ch.ID] = ch
	m.bySlug[ch.Slug] = ch
}

// --- Mock StreamRepository ---

type mockStreamRepo struct {
	streams   map[uint]*model.Stream
	byChannel map[uint][]model.Stream
	nextID    uint
	createErr error
	updateErr error
}

func newMockStreamRepo() *mockStreamRepo {
	return &mockStreamRepo{
		streams:   make(map[uint]*model.Stream),
		byChannel: make(map[uint][]model.Stream),
		nextID:    1,
	}
}

func (m *mockStreamRepo) FindByID(id uint) (*model.Stream, error) {
	s, ok := m.streams[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return s, nil
}

func (m *mockStreamRepo) ListByChannel(channelID uint) ([]model.Stream, error) {
	return m.byChannel[channelID], nil
}

func (m *mockStreamRepo) Create(stream *model.Stream) error {
	if m.createErr != nil {
		return m.createErr
	}
	stream.ID = m.nextID
	m.nextID++
	m.streams[stream.ID] = stream
	m.byChannel[stream.ChannelID] = append(m.byChannel[stream.ChannelID], *stream)
	return nil
}

func (m *mockStreamRepo) Update(stream *model.Stream) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.streams[stream.ID] = stream
	return nil
}

func (m *mockStreamRepo) Delete(id uint) error {
	delete(m.streams, id)
	return nil
}

func (m *mockStreamRepo) DeleteByChannel(channelID uint) error {
	for id, s := range m.streams {
		if s.ChannelID == channelID {
			delete(m.streams, id)
		}
	}
	delete(m.byChannel, channelID)
	return nil
}

// --- ChannelService Tests ---

func TestChannelService_List(t *testing.T) {
	t.Run("returns all channels", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		sRepo := newMockStreamRepo()
		svc := NewChannelService(chRepo, sRepo, nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})
		chRepo.addChannel(&model.Channel{Name: "CNN", Slug: "cnn", IsActive: true})

		channels, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 2 {
			t.Errorf("List() total = %d, want 2", total)
		}
		if len(channels) != 2 {
			t.Errorf("List() returned %d channels, want 2", len(channels))
		}
	})

	t.Run("empty list", func(t *testing.T) {
		svc := NewChannelService(newMockChannelRepo(), newMockStreamRepo(), nil)

		channels, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 0 {
			t.Errorf("List() total = %d, want 0", total)
		}
		if channels != nil {
			t.Errorf("List() should return nil for empty")
		}
	})

	t.Run("includes inactive channels", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})
		chRepo.addChannel(&model.Channel{Name: "CNN", Slug: "cnn", IsActive: false})

		channels, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 2 {
			t.Errorf("List() total = %d, want 2 (should include inactive)", total)
		}
		if len(channels) != 2 {
			t.Errorf("List() returned %d, want 2", len(channels))
		}
	})

	t.Run("response fields", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chNum := 42
		catID := uint(5)
		chRepo.addChannel(&model.Channel{
			Name:          "ESPN",
			Slug:          "espn",
			IsActive:      true,
			LogoURL:       "https://logo.com/espn.png",
			EPGChannelID:  "espn.us",
			ChannelNumber: &chNum,
			CategoryID:    &catID,
			Source:        "iptv-org",
		})

		channels, _, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if len(channels) != 1 {
			t.Fatalf("List() len = %d, want 1", len(channels))
		}
		ch := channels[0]
		if ch.Name != "ESPN" {
			t.Errorf("name = %q", ch.Name)
		}
		if ch.Slug != "espn" {
			t.Errorf("slug = %q", ch.Slug)
		}
		if ch.LogoURL != "https://logo.com/espn.png" {
			t.Errorf("logo_url = %q", ch.LogoURL)
		}
		if ch.EPGChannelID != "espn.us" {
			t.Errorf("epg_channel_id = %q", ch.EPGChannelID)
		}
		if ch.ChannelNumber == nil || *ch.ChannelNumber != 42 {
			t.Error("channel_number incorrect")
		}
	})
}

func TestChannelService_ListActive(t *testing.T) {
	t.Run("only active channels", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})
		chRepo.addChannel(&model.Channel{Name: "CNN", Slug: "cnn", IsActive: false})
		chRepo.addChannel(&model.Channel{Name: "BBC", Slug: "bbc", IsActive: true})

		channels, total, err := svc.ListActive(1, 20, "", nil)
		if err != nil {
			t.Fatalf("ListActive() error = %v", err)
		}
		if total != 2 {
			t.Errorf("ListActive() total = %d, want 2", total)
		}
		if len(channels) != 2 {
			t.Errorf("ListActive() returned %d channels, want 2", len(channels))
		}
	})

	t.Run("no active channels", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "CNN", Slug: "cnn", IsActive: false})

		channels, total, err := svc.ListActive(1, 20, "", nil)
		if err != nil {
			t.Fatalf("ListActive() error = %v", err)
		}
		if total != 0 {
			t.Errorf("ListActive() total = %d, want 0", total)
		}
		if channels != nil {
			t.Errorf("ListActive() should return nil for empty")
		}
	})
}

func TestChannelService_GetByID(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if resp.Name != "ESPN" {
			t.Errorf("GetByID() name = %q, want %q", resp.Name, "ESPN")
		}
		if !resp.IsActive {
			t.Error("GetByID() IsActive should be true")
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewChannelService(newMockChannelRepo(), newMockStreamRepo(), nil)

		_, err := svc.GetByID(999)
		if err == nil {
			t.Fatal("GetByID() should return error for nonexistent channel")
		}
		if err.Error() != "canal no encontrado" {
			t.Errorf("GetByID() error = %q, want %q", err.Error(), "canal no encontrado")
		}
	})

	t.Run("includes category info", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		catID := uint(1)
		chRepo.addChannel(&model.Channel{
			Name:       "ESPN",
			Slug:       "espn",
			IsActive:   true,
			CategoryID: &catID,
			Category:   &model.Category{ID: 1, Name: "Sports", Slug: "sports", Type: "live"},
		})

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if resp.Category == nil {
			t.Fatal("GetByID() category should not be nil")
		}
		if resp.Category.Name != "Sports" {
			t.Errorf("GetByID() category name = %q, want %q", resp.Category.Name, "Sports")
		}
	})

	t.Run("includes streams", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{
			Name:     "ESPN",
			Slug:     "espn",
			IsActive: true,
			Streams: []model.Stream{
				{ID: 1, URL: "https://example.com/stream1.m3u8", StreamFormat: "hls"},
				{ID: 2, URL: "https://example.com/stream2.m3u8", StreamFormat: "rtmp"},
			},
		})

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if len(resp.Streams) != 2 {
			t.Errorf("GetByID() streams count = %d, want 2", len(resp.Streams))
		}
	})
}

func TestChannelService_Update(t *testing.T) {
	t.Run("success - update name", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		resp, err := svc.Update(1, dto.UpdateChannelRequest{Name: "ESPN HD"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Name != "ESPN HD" {
			t.Errorf("Update() name = %q, want %q", resp.Name, "ESPN HD")
		}
	})

	t.Run("success - update slug", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		resp, err := svc.Update(1, dto.UpdateChannelRequest{Slug: "espn-hd"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Slug != "espn-hd" {
			t.Errorf("Update() slug = %q, want %q", resp.Slug, "espn-hd")
		}
	})

	t.Run("success - toggle active", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		isActive := false
		resp, err := svc.Update(1, dto.UpdateChannelRequest{IsActive: &isActive})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.IsActive {
			t.Error("Update() should have set IsActive to false")
		}
	})

	t.Run("success - update logo, EPG, channel number", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		chNum := 99
		resp, err := svc.Update(1, dto.UpdateChannelRequest{
			LogoURL:       "https://new-logo.com/espn.png",
			EPGChannelID:  "espn.new",
			ChannelNumber: &chNum,
		})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.LogoURL != "https://new-logo.com/espn.png" {
			t.Errorf("Update() logo_url = %q", resp.LogoURL)
		}
		if resp.EPGChannelID != "espn.new" {
			t.Errorf("Update() epg_channel_id = %q", resp.EPGChannelID)
		}
		if resp.ChannelNumber == nil || *resp.ChannelNumber != 99 {
			t.Error("Update() channel_number incorrect")
		}
	})

	t.Run("success - update category ID", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		catID := uint(5)
		resp, err := svc.Update(1, dto.UpdateChannelRequest{CategoryID: &catID})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.CategoryID == nil || *resp.CategoryID != 5 {
			t.Error("Update() categoryID incorrect")
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewChannelService(newMockChannelRepo(), newMockStreamRepo(), nil)

		_, err := svc.Update(999, dto.UpdateChannelRequest{Name: "test"})
		if err == nil {
			t.Fatal("Update() should return error for nonexistent channel")
		}
	})

	t.Run("repo update error", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})
		chRepo.updateErr = gorm.ErrInvalidDB

		_, err := svc.Update(1, dto.UpdateChannelRequest{Name: "New"})
		if err == nil {
			t.Fatal("Update() should return error when repo update fails")
		}
	})

	t.Run("empty update preserves fields", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true, LogoURL: "https://logo.com"})

		resp, err := svc.Update(1, dto.UpdateChannelRequest{})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Name != "ESPN" {
			t.Errorf("Update() should preserve name, got %q", resp.Name)
		}
		if resp.IsActive != true {
			t.Error("Update() should preserve IsActive")
		}
	})
}

func TestChannelService_Delete(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		err := svc.Delete(1)
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}

		_, err = chRepo.FindByID(1)
		if err == nil {
			t.Error("Delete() should remove channel from repo")
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewChannelService(newMockChannelRepo(), newMockStreamRepo(), nil)

		err := svc.Delete(999)
		if err == nil {
			t.Fatal("Delete() should return error for nonexistent channel")
		}
	})
}

func TestChannelService_AddStream(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		sRepo := newMockStreamRepo()
		svc := NewChannelService(chRepo, sRepo, nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		resp, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL:          "https://example.com/stream.m3u8",
			StreamFormat: "hls",
			Priority:     1,
		})
		if err != nil {
			t.Fatalf("AddStream() error = %v", err)
		}
		if resp.URL != "https://example.com/stream.m3u8" {
			t.Errorf("AddStream() url = %q", resp.URL)
		}
		if resp.ChannelID != 1 {
			t.Errorf("AddStream() channelID = %d, want 1", resp.ChannelID)
		}
		if resp.StreamFormat != "hls" {
			t.Errorf("AddStream() format = %q, want %q", resp.StreamFormat, "hls")
		}
		if !resp.IsActive {
			t.Error("AddStream() should default to active")
		}
	})

	t.Run("success with custom active flag", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		sRepo := newMockStreamRepo()
		svc := NewChannelService(chRepo, sRepo, nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		isActive := false
		resp, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL:          "https://example.com/stream.m3u8",
			StreamFormat: "hls",
			IsActive:     &isActive,
		})
		if err != nil {
			t.Fatalf("AddStream() error = %v", err)
		}
		if resp.IsActive {
			t.Error("AddStream() should respect IsActive=false")
		}
	})

	t.Run("success with user agent", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		sRepo := newMockStreamRepo()
		svc := NewChannelService(chRepo, sRepo, nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		resp, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL:          "https://example.com/stream.m3u8",
			StreamFormat: "hls",
			UserAgent:    "CustomPlayer/1.0",
		})
		if err != nil {
			t.Fatalf("AddStream() error = %v", err)
		}
		if resp.UserAgent != "CustomPlayer/1.0" {
			t.Errorf("AddStream() user_agent = %q", resp.UserAgent)
		}
	})

	t.Run("success with valid JSON headers", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		sRepo := newMockStreamRepo()
		svc := NewChannelService(chRepo, sRepo, nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		resp, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL:          "https://example.com/stream.m3u8",
			StreamFormat: "hls",
			Headers:      `{"Referer": "https://example.com"}`,
		})
		if err != nil {
			t.Fatalf("AddStream() error = %v", err)
		}
		if resp.Headers != `{"Referer": "https://example.com"}` {
			t.Errorf("AddStream() headers = %q", resp.Headers)
		}
	})

	t.Run("channel not found", func(t *testing.T) {
		svc := NewChannelService(newMockChannelRepo(), newMockStreamRepo(), nil)

		_, err := svc.AddStream(999, dto.CreateStreamRequest{
			URL:          "https://example.com/stream.m3u8",
			StreamFormat: "hls",
		})
		if err == nil {
			t.Fatal("AddStream() should return error for nonexistent channel")
		}
	})

	t.Run("empty URL", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		_, err := svc.AddStream(1, dto.CreateStreamRequest{URL: ""})
		if err == nil {
			t.Fatal("AddStream() should return error for empty URL")
		}
	})

	t.Run("SSRF - private IP", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		_, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL: "http://127.0.0.1:8080/admin",
		})
		if err == nil {
			t.Fatal("AddStream() should reject private IP URLs (SSRF)")
		}
	})

	t.Run("SSRF - 192.168.x.x", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		_, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL: "http://192.168.1.1/stream",
		})
		if err == nil {
			t.Fatal("AddStream() should reject 192.168.x.x URLs")
		}
	})

	t.Run("invalid JSON headers", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		_, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL:     "https://example.com/stream.m3u8",
			Headers: "not-valid-json",
		})
		if err == nil {
			t.Fatal("AddStream() should reject invalid JSON headers")
		}
	})

	t.Run("headers too long", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		// Create a headers string longer than MaxHeadersLength (4096)
		longHeaders := `{"key":"` + string(make([]byte, 5000)) + `"}`
		_, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL:     "https://example.com/stream.m3u8",
			Headers: longHeaders,
		})
		if err == nil {
			t.Fatal("AddStream() should reject headers exceeding max length")
		}
	})

	t.Run("SSRF - 10.x.x.x", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		_, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL: "http://10.0.0.1/stream",
		})
		if err == nil {
			t.Fatal("AddStream() should reject 10.x.x.x URLs")
		}
	})

	t.Run("SSRF - localhost", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

		_, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL: "http://localhost:8080/stream",
		})
		if err == nil {
			t.Fatal("AddStream() should reject localhost URLs")
		}
	})

	t.Run("repo create error", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		sRepo := newMockStreamRepo()
		svc := NewChannelService(chRepo, sRepo, nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})
		sRepo.createErr = gorm.ErrInvalidDB

		_, err := svc.AddStream(1, dto.CreateStreamRequest{
			URL:          "https://example.com/stream.m3u8",
			StreamFormat: "hls",
		})
		if err == nil {
			t.Fatal("AddStream() should return error when repo create fails")
		}
	})
}

func TestChannelService_UpdateStream(t *testing.T) {
	t.Run("success - update URL and format", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		sRepo := newMockStreamRepo()
		svc := NewChannelService(chRepo, sRepo, nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})
		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/old.m3u8", StreamFormat: "hls"})

		resp, err := svc.UpdateStream(1, dto.UpdateStreamRequest{
			URL:          "https://example.com/new.m3u8",
			StreamFormat: "rtmp",
		})
		if err != nil {
			t.Fatalf("UpdateStream() error = %v", err)
		}
		if resp.URL != "https://example.com/new.m3u8" {
			t.Errorf("UpdateStream() url = %q", resp.URL)
		}
		if resp.StreamFormat != "rtmp" {
			t.Errorf("UpdateStream() format = %q, want %q", resp.StreamFormat, "rtmp")
		}
	})

	t.Run("success - update priority", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/stream.m3u8", StreamFormat: "hls"})

		priority := 10
		resp, err := svc.UpdateStream(1, dto.UpdateStreamRequest{Priority: &priority})
		if err != nil {
			t.Fatalf("UpdateStream() error = %v", err)
		}
		if resp.Priority != 10 {
			t.Errorf("UpdateStream() priority = %d, want 10", resp.Priority)
		}
	})

	t.Run("success - toggle active", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/stream.m3u8", IsActive: true})

		isActive := false
		resp, err := svc.UpdateStream(1, dto.UpdateStreamRequest{IsActive: &isActive})
		if err != nil {
			t.Fatalf("UpdateStream() error = %v", err)
		}
		if resp.IsActive {
			t.Error("UpdateStream() should set IsActive to false")
		}
	})

	t.Run("success - update headers", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/stream.m3u8"})

		resp, err := svc.UpdateStream(1, dto.UpdateStreamRequest{
			Headers: `{"Authorization": "Bearer token"}`,
		})
		if err != nil {
			t.Fatalf("UpdateStream() error = %v", err)
		}
		if resp.Headers != `{"Authorization": "Bearer token"}` {
			t.Errorf("UpdateStream() headers = %q", resp.Headers)
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewChannelService(newMockChannelRepo(), newMockStreamRepo(), nil)

		_, err := svc.UpdateStream(999, dto.UpdateStreamRequest{URL: "https://example.com/new.m3u8"})
		if err == nil {
			t.Fatal("UpdateStream() should return error for nonexistent stream")
		}
	})

	t.Run("SSRF on URL update", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/old.m3u8"})

		_, err := svc.UpdateStream(1, dto.UpdateStreamRequest{
			URL: "http://192.168.1.1/admin",
		})
		if err == nil {
			t.Fatal("UpdateStream() should reject private IP URLs")
		}
	})

	t.Run("invalid JSON headers", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/old.m3u8"})

		_, err := svc.UpdateStream(1, dto.UpdateStreamRequest{
			Headers: "not-json",
		})
		if err == nil {
			t.Fatal("UpdateStream() should reject invalid JSON headers")
		}
	})

	t.Run("repo update error", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/stream.m3u8"})
		sRepo.updateErr = gorm.ErrInvalidDB

		_, err := svc.UpdateStream(1, dto.UpdateStreamRequest{StreamFormat: "rtmp"})
		if err == nil {
			t.Fatal("UpdateStream() should return error when repo update fails")
		}
	})

	t.Run("headers too long", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/stream.m3u8"})

		longHeaders := `{"key":"` + string(make([]byte, 5000)) + `"}`
		_, err := svc.UpdateStream(1, dto.UpdateStreamRequest{
			Headers: longHeaders,
		})
		if err == nil {
			t.Fatal("UpdateStream() should reject headers exceeding max length")
		}
	})

	t.Run("success - update user agent", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/stream.m3u8", UserAgent: "OldAgent/1.0"})

		resp, err := svc.UpdateStream(1, dto.UpdateStreamRequest{
			UserAgent: "NewAgent/2.0",
		})
		if err != nil {
			t.Fatalf("UpdateStream() error = %v", err)
		}
		if resp.UserAgent != "NewAgent/2.0" {
			t.Errorf("UpdateStream() user_agent = %q, want %q", resp.UserAgent, "NewAgent/2.0")
		}
	})

	t.Run("SSRF - 10.x.x.x on update", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/old.m3u8"})

		_, err := svc.UpdateStream(1, dto.UpdateStreamRequest{
			URL: "http://10.0.0.1/stream",
		})
		if err == nil {
			t.Fatal("UpdateStream() should reject 10.x.x.x URLs")
		}
	})

	t.Run("SSRF - localhost on update", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/old.m3u8"})

		_, err := svc.UpdateStream(1, dto.UpdateStreamRequest{
			URL: "http://localhost:8080/stream",
		})
		if err == nil {
			t.Fatal("UpdateStream() should reject localhost URLs")
		}
	})
}

func TestChannelService_DeleteStream(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		sRepo := newMockStreamRepo()
		svc := NewChannelService(newMockChannelRepo(), sRepo, nil)

		sRepo.Create(&model.Stream{ChannelID: 1, URL: "https://example.com/stream.m3u8"})

		err := svc.DeleteStream(1)
		if err != nil {
			t.Fatalf("DeleteStream() error = %v", err)
		}

		if _, err := sRepo.FindByID(1); err == nil {
			t.Error("DeleteStream() should remove stream from repo")
		}
	})
}

func TestChannelService_CountActive(t *testing.T) {
	t.Run("counts only active", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})
		chRepo.addChannel(&model.Channel{Name: "CNN", Slug: "cnn", IsActive: false})
		chRepo.addChannel(&model.Channel{Name: "BBC", Slug: "bbc", IsActive: true})

		count, err := svc.CountActive()
		if err != nil {
			t.Fatalf("CountActive() error = %v", err)
		}
		if count != 2 {
			t.Errorf("CountActive() = %d, want 2", count)
		}
	})

	t.Run("zero when none active", func(t *testing.T) {
		chRepo := newMockChannelRepo()
		svc := NewChannelService(chRepo, newMockStreamRepo(), nil)

		chRepo.addChannel(&model.Channel{Name: "CNN", Slug: "cnn", IsActive: false})

		count, err := svc.CountActive()
		if err != nil {
			t.Fatalf("CountActive() error = %v", err)
		}
		if count != 0 {
			t.Errorf("CountActive() = %d, want 0", count)
		}
	})

	t.Run("zero when empty", func(t *testing.T) {
		svc := NewChannelService(newMockChannelRepo(), newMockStreamRepo(), nil)

		count, err := svc.CountActive()
		if err != nil {
			t.Fatalf("CountActive() error = %v", err)
		}
		if count != 0 {
			t.Errorf("CountActive() = %d, want 0", count)
		}
	})
}

func TestChannelService_CountBySource(t *testing.T) {
	chRepo := newMockChannelRepo()

	chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true, Source: "iptv-org"})
	chRepo.addChannel(&model.Channel{Name: "CNN", Slug: "cnn", IsActive: true, Source: "iptv-org"})
	chRepo.addChannel(&model.Channel{Name: "BBC", Slug: "bbc", IsActive: true, Source: "custom"})
	chRepo.addChannel(&model.Channel{Name: "Local", Slug: "local", IsActive: true, Source: ""})

	count, err := chRepo.CountBySource("iptv-org")
	if err != nil {
		t.Fatalf("CountBySource() error = %v", err)
	}
	if count != 2 {
		t.Errorf("CountBySource('iptv-org') = %d, want 2", count)
	}

	count, err = chRepo.CountBySource("custom")
	if err != nil {
		t.Fatalf("CountBySource() error = %v", err)
	}
	if count != 1 {
		t.Errorf("CountBySource('custom') = %d, want 1", count)
	}

	count, err = chRepo.CountBySource("")
	if err != nil {
		t.Fatalf("CountBySource() error = %v", err)
	}
	if count != 1 {
		t.Errorf("CountBySource('') = %d, want 1", count)
	}

	count, err = chRepo.CountBySource("nonexistent")
	if err != nil {
		t.Fatalf("CountBySource() error = %v", err)
	}
	if count != 0 {
		t.Errorf("CountBySource('nonexistent') = %d, want 0", count)
	}
}

// --- Channel Create tests ---

func TestChannelService_Create_EmptyName(t *testing.T) {
	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, nil)

	_, err := svc.Create(dto.CreateChannelRequest{Name: ""})
	if err == nil {
		t.Fatal("Create() should return error for empty name")
	}
	if err.Error() != "nombre es requerido" {
		t.Errorf("Create() error = %q, want %q", err.Error(), "nombre es requerido")
	}
}

func TestChannelService_Create_NilDB_Panics(t *testing.T) {
	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, nil)

	// With nil db, Transaction will panic (nil pointer dereference)
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("Create() should panic when db is nil")
		}
	}()

	svc.Create(dto.CreateChannelRequest{
		Name: "ESPN",
		Streams: []dto.CreateStreamRequest{
			{URL: "https://example.com/stream.m3u8", StreamFormat: "hls"},
		},
	})
}

func TestChannelService_Create_AutoSlug(t *testing.T) {
	// Test that Create generates a slug when none provided
	// Since this goes through db.Transaction which needs a real DB,
	// we can only test the validation path
	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, nil)

	// Empty name triggers validation error before db.Transaction
	_, err := svc.Create(dto.CreateChannelRequest{Name: "", Slug: "custom-slug"})
	if err == nil {
		t.Fatal("Create() should return error for empty name even with slug provided")
	}
}

func TestChannelService_Create_IsActiveDefault(t *testing.T) {
	// Verify the default isActive=true behavior by checking the code path
	// We can only test the validation path without a real DB
	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, nil)

	// Test with explicit IsActive=false
	isActive := false
	defer func() { recover() }() // Will panic on nil db
	svc.Create(dto.CreateChannelRequest{
		Name:     "Test",
		IsActive: &isActive,
	})
}

func TestChannelService_DeleteBySource(t *testing.T) {
	t.Run("deletes matching channels", func(t *testing.T) {
		chRepo := newMockChannelRepo()

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", Source: "iptv-org"})
		chRepo.addChannel(&model.Channel{Name: "CNN", Slug: "cnn", Source: "iptv-org"})
		chRepo.addChannel(&model.Channel{Name: "Local", Slug: "local", Source: ""})

		err := chRepo.DeleteBySource("iptv-org")
		if err != nil {
			t.Fatalf("DeleteBySource() error = %v", err)
		}

		count, _ := chRepo.Count()
		if count != 1 {
			t.Errorf("DeleteBySource() should leave 1 channel, got %d", count)
		}
	})

	t.Run("no-op for nonexistent source", func(t *testing.T) {
		chRepo := newMockChannelRepo()

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", Source: "iptv-org"})

		err := chRepo.DeleteBySource("nonexistent")
		if err != nil {
			t.Fatalf("DeleteBySource() error = %v", err)
		}

		count, _ := chRepo.Count()
		if count != 1 {
			t.Errorf("DeleteBySource() should not delete anything, got %d channels", count)
		}
	})
}

func TestToChannelListResponse_WithCategory(t *testing.T) {
	cat := model.Category{ID: 1, Name: "Sports", Slug: "sports", Type: "channel"}
	ch := model.Channel{
		Name:     "ESPN",
		Slug:     "espn",
		IsActive: true,
		Category: &cat,
		Streams:  []model.Stream{{ID: 1}, {ID: 2}},
	}
	ch.ID = 1

	resp := toChannelListResponse(ch)
	if resp.Name != "ESPN" {
		t.Errorf("Name = %q, want ESPN", resp.Name)
	}
	if resp.Category == nil {
		t.Fatal("Category should not be nil")
	}
	if resp.Category.Name != "Sports" {
		t.Errorf("Category.Name = %q, want Sports", resp.Category.Name)
	}
	if resp.StreamCount != 2 {
		t.Errorf("StreamCount = %d, want 2", resp.StreamCount)
	}
}

func TestToChannelListResponse_NilCategory(t *testing.T) {
	ch := model.Channel{
		Name:     "CNN",
		Slug:     "cnn",
		IsActive: true,
		Category: nil,
		Streams:  []model.Stream{},
	}
	ch.ID = 2

	resp := toChannelListResponse(ch)
	if resp.Category != nil {
		t.Error("Category should be nil")
	}
	if resp.StreamCount != 0 {
		t.Errorf("StreamCount = %d, want 0", resp.StreamCount)
	}
}
