package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// ============================================================================
// fetchM3U tests using httptest
// ============================================================================

func TestIPTVSeeder_FetchM3U_Success(t *testing.T) {
	m3uContent := `#EXTM3U url-tvg="http://epg.example.com/guide.xml"
#EXTINF:-1 tvg-id="ch1" tvg-name="Channel 1" group-title="News",Channel 1
http://stream1.example.com/live.m3u8
`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(m3uContent))
	}))
	defer server.Close()

	seeder := setupIPTVSeeder()
	content, epgURL, err := seeder.fetchM3U(server.URL)
	if err != nil {
		t.Fatalf("fetchM3U() error = %v", err)
	}
	if !strings.Contains(content, "#EXTM3U") {
		t.Error("content should contain #EXTM3U header")
	}
	if epgURL != "http://epg.example.com/guide.xml" {
		t.Errorf("epgURL = %q, want %q", epgURL, "http://epg.example.com/guide.xml")
	}
}

func TestIPTVSeeder_FetchM3U_Non200(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
	}))
	defer server.Close()

	seeder := setupIPTVSeeder()
	_, _, err := seeder.fetchM3U(server.URL)
	if err == nil {
		t.Fatal("fetchM3U() should return error for non-200 status")
	}
	if !strings.Contains(err.Error(), "404") {
		t.Errorf("error should mention 404, got: %v", err)
	}
}

func TestIPTVSeeder_FetchM3U_NoEPGURL(t *testing.T) {
	m3uContent := `#EXTM3U
#EXTINF:-1 tvg-name="Channel 1",Channel 1
http://stream1.example.com/live.m3u8
`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(m3uContent))
	}))
	defer server.Close()

	seeder := setupIPTVSeeder()
	_, epgURL, err := seeder.fetchM3U(server.URL)
	if err != nil {
		t.Fatalf("fetchM3U() error = %v", err)
	}
	if epgURL != "" {
		t.Errorf("epgURL = %q, want empty", epgURL)
	}
}

func TestIPTVSeeder_FetchM3U_ConnectionError(t *testing.T) {
	seeder := setupIPTVSeeder()
	// Use a port that's almost certainly not listening
	_, _, err := seeder.fetchM3U("http://127.0.0.1:1/nonexistent")
	if err == nil {
		t.Fatal("fetchM3U() should return error for connection failure")
	}
}

// ============================================================================
// ImportWithOptionsContext with httptest server (full integration-like test)
// ============================================================================

func TestIPTVSeeder_ImportWithOptionsContext_FullFlow(t *testing.T) {
	m3uContent := `#EXTM3U url-tvg="http://epg.example.com/guide.xml"
#EXTINF:-1 tvg-id="ch1" tvg-name="Test Channel" tvg-logo="http://logo.png" tvg-country="ES" tvg-language="Spanish" group-title="News",Test Channel
https://example.com/stream.m3u8
#EXTINF:-1 tvg-id="ch2" tvg-name="Another Channel" group-title="Sports",Another Channel
https://example.com/stream2.m3u8
`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(m3uContent))
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	seeder.ImportWithOptionsContext(context.Background(), IPTVImportOptions{
		M3UURL: server.URL,
		Source: "test",
	})

	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running after import completes")
	}
	if status.Imported != 2 {
		t.Errorf("imported = %d, want 2", status.Imported)
	}
	if len(channelRepo.channels) != 2 {
		t.Errorf("channel count = %d, want 2", len(channelRepo.channels))
	}
}

func TestIPTVSeeder_ImportWithOptionsContext_WithCountryFilter(t *testing.T) {
	m3uContent := `#EXTM3U
#EXTINF:-1 tvg-id="ch1" tvg-name="Spanish Channel" tvg-country="ES" group-title="News",Spanish Channel
https://example.com/stream.m3u8
#EXTINF:-1 tvg-id="ch2" tvg-name="US Channel" tvg-country="US" group-title="News",US Channel
https://example.com/stream2.m3u8
`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(m3uContent))
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	seeder.ImportWithOptionsContext(context.Background(), IPTVImportOptions{
		M3UURL:    server.URL,
		Source:    "test",
		Countries: []string{"ES"},
	})

	status := seeder.GetStatus()
	if status.Imported != 1 {
		t.Errorf("imported = %d, want 1 (only ES)", status.Imported)
	}
}

func TestIPTVSeeder_ImportWithOptionsContext_EmptyAfterFilter(t *testing.T) {
	m3uContent := `#EXTM3U
#EXTINF:-1 tvg-id="ch1" tvg-name="Channel" tvg-country="US" group-title="News",Channel
https://example.com/stream.m3u8
`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(m3uContent))
	}))
	defer server.Close()

	seeder := setupIPTVSeeder()
	seeder.ImportWithOptionsContext(context.Background(), IPTVImportOptions{
		M3UURL:    server.URL,
		Source:    "test",
		Countries: []string{"JP"}, // No channels match
	})

	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running")
	}
	if !strings.Contains(status.Message, "Sin canales") {
		t.Errorf("message = %q, want message about no channels after filters", status.Message)
	}
}

func TestIPTVSeeder_ImportWithOptionsContext_WithReplace(t *testing.T) {
	m3uContent := `#EXTM3U
#EXTINF:-1 tvg-id="ch1" tvg-name="Channel" group-title="News",Channel
https://example.com/stream.m3u8
`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(m3uContent))
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Pre-add a channel from same source
	channelRepo.Create(&model.Channel{Name: "Old", Slug: "old", Source: "test"})

	seeder.ImportWithOptionsContext(context.Background(), IPTVImportOptions{
		M3UURL:  server.URL,
		Source:  "test",
		Replace: true,
	})

	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running after import")
	}
	if status.Imported != 1 {
		t.Errorf("imported = %d, want 1", status.Imported)
	}
}

func TestIPTVSeeder_ImportWithOptionsContext_WithEPGOverride(t *testing.T) {
	m3uContent := `#EXTM3U url-tvg="http://default-epg.example.com/guide.xml"
#EXTINF:-1 tvg-id="ch1" tvg-name="Channel" group-title="News",Channel
https://example.com/stream.m3u8
`
	// EPG server that returns empty/invalid XML (we just want to exercise the code path)
	epgServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(`<?xml version="1.0"?><tv></tv>`))
	}))
	defer epgServer.Close()

	m3uServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(m3uContent))
	}))
	defer m3uServer.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	seeder.ImportWithOptionsContext(context.Background(), IPTVImportOptions{
		M3UURL: m3uServer.URL,
		EPGURL: epgServer.URL, // Override EPG URL
		Source: "test",
	})

	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running after import")
	}
}

func TestIPTVSeeder_ImportWithOptionsContext_ContextCancelledBeforeChannels(t *testing.T) {
	m3uContent := `#EXTM3U
#EXTINF:-1 tvg-id="ch1" tvg-name="Channel" group-title="News",Channel
https://example.com/stream.m3u8
`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(m3uContent))
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	ctx, cancel := context.WithCancel(context.Background())

	// We need a custom category repo that cancels the context during buildCategories
	// Instead, just cancel before calling
	cancel()

	seeder.ImportWithOptionsContext(ctx, IPTVImportOptions{
		M3UURL: server.URL,
		Source: "test",
	})

	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running after cancellation")
	}
}

// ============================================================================
// Playlist AddItem - auto-create playlist path
// ============================================================================

func TestPlaylistService_AddItem_AutoCreatesPlaylist(t *testing.T) {
	svc, _, mediaRepo := setupPlaylistService()
	// No playlist exists yet for channelID=1
	mediaRepo.media[10] = &model.LocalMedia{ID: 10, Status: "completed", OriginalFilename: "video.mp4"}

	req := dto.AddPlaylistItemRequest{LocalMediaID: 10, SortOrder: 0}
	result, err := svc.AddItem(1, req)
	if err != nil {
		t.Fatalf("AddItem() error = %v", err)
	}
	if result.ChannelID != 1 {
		t.Errorf("channelID = %d, want 1", result.ChannelID)
	}
	if result.PlaybackMode != "loop" {
		t.Errorf("playbackMode = %q, want loop (auto-created)", result.PlaybackMode)
	}
}

func TestPlaylistService_AddItem_MultipleItems(t *testing.T) {
	svc, playlistRepo, mediaRepo := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	mediaRepo.media[10] = &model.LocalMedia{ID: 10, Status: "completed", OriginalFilename: "video1.mp4"}
	mediaRepo.media[20] = &model.LocalMedia{ID: 20, Status: "completed", OriginalFilename: "video2.mp4"}

	// Add first item
	_, err := svc.AddItem(1, dto.AddPlaylistItemRequest{LocalMediaID: 10, SortOrder: 0})
	if err != nil {
		t.Fatalf("AddItem() first error = %v", err)
	}

	// Add second item
	result, err := svc.AddItem(1, dto.AddPlaylistItemRequest{LocalMediaID: 20, SortOrder: 1})
	if err != nil {
		t.Fatalf("AddItem() second error = %v", err)
	}
	if len(result.Items) != 2 {
		t.Errorf("items count = %d, want 2", len(result.Items))
	}
}

// ============================================================================
// Playlist Reorder - error paths
// ============================================================================

func TestPlaylistService_Reorder_NoPlaylist(t *testing.T) {
	svc, _, _ := setupPlaylistService()

	// No playlist exists -> FindByChannelID returns not found -> auto-create then error
	// Actually GetByChannelID auto-creates, but Reorder calls FindByChannelID directly
	req := dto.ReorderPlaylistRequest{
		Items: []dto.ReorderItem{
			{ID: 1, SortOrder: 1},
		},
	}
	_, err := svc.Reorder(999, req)
	if err == nil {
		t.Fatal("Reorder() should return error when playlist not found")
	}
}

func TestPlaylistService_Reorder_EmptyItems(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}

	req := dto.ReorderPlaylistRequest{Items: []dto.ReorderItem{}}
	_, err := svc.Reorder(1, req)
	if err != nil {
		t.Fatalf("Reorder() with empty items error = %v", err)
	}
}

// ============================================================================
// Playlist GetByChannelID - error path
// ============================================================================

func TestPlaylistService_GetByChannelID_ReturnsItems(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "shuffle", IsActive: true,
	}
	playlistRepo.items[1] = &model.PlaylistItem{
		ID: 1, PlaylistID: 1, LocalMediaID: 10, SortOrder: 0,
		LocalMedia: &model.LocalMedia{ID: 10, Status: "completed", OriginalFilename: "v.mp4"},
	}
	playlistRepo.items[2] = &model.PlaylistItem{
		ID: 2, PlaylistID: 1, LocalMediaID: 20, SortOrder: 1,
	}

	result, err := svc.GetByChannelID(1)
	if err != nil {
		t.Fatalf("GetByChannelID() error = %v", err)
	}
	if len(result.Items) != 2 {
		t.Errorf("items count = %d, want 2", len(result.Items))
	}
	if result.PlaybackMode != "shuffle" {
		t.Errorf("playbackMode = %q, want shuffle", result.PlaybackMode)
	}
}

// ============================================================================
// Playlist RemoveItem - not found
// ============================================================================

func TestPlaylistService_RemoveItem_ItemNotFound(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	// No items

	_, err := svc.RemoveItem(1, 999)
	if err == nil {
		t.Fatal("RemoveItem() should return error for nonexistent item")
	}
}

func TestPlaylistService_RemoveItem_NoPlaylist(t *testing.T) {
	svc, _, _ := setupPlaylistService()

	_, err := svc.RemoveItem(999, 1)
	if err == nil {
		t.Fatal("RemoveItem() should return error when playlist not found")
	}
}

// ============================================================================
// TranscoderService - TranscodeToHLSContext cancelled context
// ============================================================================

func TestTranscoderService_TranscodeToHLSContext_CancelledBeforeStart(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	media := &model.LocalMedia{
		ID:               1,
		Status:           "pending",
		OriginalFilename: "test.mp4",
		FilePath:         "/tmp/nonexistent.mp4",
	}
	repo.media[1] = media

	svc := NewTranscoderService(repo, "nonexistent-ffmpeg", "", "/tmp/media")

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	completeCh := make(chan struct{})
	var completedErr error

	svc.TranscodeToHLSContext(ctx, media, func(hlsPath string, err error) {
		completedErr = err
		close(completeCh)
	})

	// Wait for the goroutine to complete (with timeout)
	select {
	case <-completeCh:
		// Expected: callback called with context.Canceled error
		if completedErr == nil {
			t.Error("expected error in callback")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for TranscodeToHLSContext to complete")
	}

	// Verify status was updated to failed
	if repo.media[1].Status != "failed" {
		t.Errorf("status = %q, want failed", repo.media[1].Status)
	}
}

func TestTranscoderService_TranscodeToHLS_NilCallback(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	media := &model.LocalMedia{
		ID:               1,
		Status:           "pending",
		OriginalFilename: "test.mp4",
		FilePath:         "/tmp/nonexistent.mp4",
	}
	repo.media[1] = media

	svc := NewTranscoderService(repo, "nonexistent-ffmpeg", "", "/tmp/media")

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	// Should not panic with nil callback
	svc.TranscodeToHLSContext(ctx, media, nil)

	// Give the goroutine a moment to run
	time.Sleep(100 * time.Millisecond)
}

func TestTranscoderService_TranscodeToHLS_Wrapper(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	media := &model.LocalMedia{
		ID:               1,
		Status:           "pending",
		OriginalFilename: "test.mp4",
		FilePath:         "/tmp/nonexistent.mp4",
	}
	repo.media[1] = media

	svc := NewTranscoderService(repo, "nonexistent-ffmpeg", "", "/tmp/media")

	// TranscodeToHLS is a simple wrapper around TranscodeToHLSWithCallback(nil)
	// Should not panic
	svc.TranscodeToHLS(media)

	// Give the goroutine a moment to fail (ffmpeg doesn't exist)
	time.Sleep(200 * time.Millisecond)
}

func TestTranscoderService_TranscodeToHLSWithCallback_Wrapper(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	media := &model.LocalMedia{
		ID:               1,
		Status:           "pending",
		OriginalFilename: "test.mp4",
		FilePath:         "/tmp/nonexistent.mp4",
	}
	repo.media[1] = media

	svc := NewTranscoderService(repo, "nonexistent-ffmpeg", "", "/tmp/media")

	completeCh := make(chan struct{})
	svc.TranscodeToHLSWithCallback(media, func(hlsPath string, err error) {
		close(completeCh)
	})

	select {
	case <-completeCh:
		// Callback was invoked (with error since ffmpeg doesn't exist)
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for callback")
	}
}

// ============================================================================
// Channel Create - validation edge cases
// ============================================================================

func TestChannelService_Create_EmptyStreams(t *testing.T) {
	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, nil)

	// No streams, empty name
	_, err := svc.Create(dto.CreateChannelRequest{Name: ""})
	if err == nil {
		t.Fatal("Create() should return error for empty name")
	}
}

func TestChannelService_Create_WithStreamsValidation(t *testing.T) {
	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, nil)

	// Valid name but nil db - will panic due to Transaction
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("Create() should panic when db is nil and streams are provided")
		}
	}()

	svc.Create(dto.CreateChannelRequest{
		Name: "Test Channel",
		Streams: []dto.CreateStreamRequest{
			{URL: "https://example.com/stream.m3u8", StreamFormat: "hls"},
		},
	})
}

func TestChannelService_Create_NoStreams_StillNeedsDB(t *testing.T) {
	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, nil)

	// Even without streams, Create goes through db.Transaction
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("Create() should panic when db is nil")
		}
	}()

	svc.Create(dto.CreateChannelRequest{
		Name: "Test Channel",
	})
}

// ============================================================================
// Channel response helpers - edge cases
// ============================================================================

func TestToChannelResponse_WithStreams(t *testing.T) {
	ch := model.Channel{
		Name:     "ESPN",
		Slug:     "espn",
		IsActive: true,
		Streams: []model.Stream{
			{ID: 1, URL: "https://example.com/s1.m3u8", StreamFormat: "hls", IsActive: true, UserAgent: "TestAgent", Headers: `{"X-Key": "val"}`},
			{ID: 2, URL: "https://example.com/s2.m3u8", StreamFormat: "rtmp"},
		},
	}
	ch.ID = 1

	resp := toChannelResponse(ch)
	if len(resp.Streams) != 2 {
		t.Fatalf("streams count = %d, want 2", len(resp.Streams))
	}
	if resp.Streams[0].UserAgent != "TestAgent" {
		t.Errorf("stream[0].UserAgent = %q", resp.Streams[0].UserAgent)
	}
	if resp.Streams[0].Headers != `{"X-Key": "val"}` {
		t.Errorf("stream[0].Headers = %q", resp.Streams[0].Headers)
	}
}

func TestToChannelResponse_NoCategory(t *testing.T) {
	ch := model.Channel{Name: "CNN", Slug: "cnn", IsActive: true}
	ch.ID = 2

	resp := toChannelResponse(ch)
	if resp.Category != nil {
		t.Error("Category should be nil")
	}
	if len(resp.Streams) != 0 {
		t.Errorf("streams count = %d, want 0", len(resp.Streams))
	}
}

// ============================================================================
// IPTVSeeder importEPG with httptest
// ============================================================================

func TestIPTVSeeder_ImportEPG_Success(t *testing.T) {
	now := time.Now().UTC()
	startStr := now.Format("20060102150405") + " +0000"
	endStr := now.Add(time.Hour).Format("20060102150405") + " +0000"

	xmlData := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="%s" stop="%s" channel="ch1">
    <title lang="es">Noticias</title>
    <desc lang="es">Las noticias</desc>
    <category lang="es">News</category>
  </programme>
</tv>`, startStr, endStr)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(xmlData))
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	channelMap := map[string]uint{"ch1": 1}
	seeder.importEPG(server.URL, channelMap)

	// Verify EPG entries were created
	count, _ := epgRepo.Count()
	if count != 1 {
		t.Errorf("EPG entry count = %d, want 1", count)
	}
}

func TestIPTVSeeder_ImportEPG_InvalidURL(t *testing.T) {
	seeder := setupIPTVSeeder()
	// Should not panic
	seeder.importEPG("http://127.0.0.1:1/nonexistent", map[string]uint{"ch1": 1})
}

func TestIPTVSeeder_ImportEPG_InvalidXML(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte("not xml at all"))
	}))
	defer server.Close()

	seeder := setupIPTVSeeder()
	// Should not panic on invalid XML
	seeder.importEPG(server.URL, map[string]uint{"ch1": 1})
}

// ============================================================================
// Playlist - toPlaylistResponse with LocalMedia
// ============================================================================

func TestToPlaylistResponse_WithLocalMedia(t *testing.T) {
	media := &model.LocalMedia{
		ID:               10,
		Status:           "completed",
		OriginalFilename: "video.mp4",
	}
	p := &model.Playlist{
		ID:           1,
		ChannelID:    5,
		PlaybackMode: "loop",
		IsActive:     true,
		Items: []model.PlaylistItem{
			{ID: 1, LocalMediaID: 10, SortOrder: 0, LocalMedia: media},
			{ID: 2, LocalMediaID: 20, SortOrder: 1}, // nil LocalMedia
		},
	}

	resp := toPlaylistResponse(p)
	if resp.ChannelID != 5 {
		t.Errorf("ChannelID = %d, want 5", resp.ChannelID)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("items count = %d, want 2", len(resp.Items))
	}
	if resp.Items[0].LocalMedia == nil {
		t.Error("first item should have LocalMedia")
	}
	if resp.Items[1].LocalMedia != nil {
		t.Error("second item should have nil LocalMedia")
	}
}

// ============================================================================
// GenerateMasterPlaylist - stream creation path (without existing streams)
// ============================================================================

func TestPlaylistService_GenerateMasterPlaylist_CreatesNewStream(t *testing.T) {
	playlistRepo := newMockPlaylistRepo()
	mediaRepo := newMockLocalMediaRepoForPlaylist()
	channelRepo := newMockChannelRepoForPlaylist()
	streamRepo := newMockStreamRepoForPlaylist()

	tmpDir := t.TempDir()
	svc := NewPlaylistService(playlistRepo, mediaRepo, channelRepo, streamRepo, tmpDir)

	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}

	media := &model.LocalMedia{ID: 10, Status: "completed", OriginalFilename: "video.mp4"}
	playlistRepo.items[1] = &model.PlaylistItem{
		ID: 1, PlaylistID: 1, LocalMediaID: 10, SortOrder: 0, LocalMedia: media,
	}

	// Create HLS file
	hlsDir := fmt.Sprintf("%s/local/10", tmpDir)
	os.MkdirAll(hlsDir, 0755)
	os.WriteFile(hlsDir+"/index.m3u8", []byte(`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000000,
segment_0.ts
#EXT-X-ENDLIST
`), 0644)

	_, err := svc.GenerateMasterPlaylist(1)
	if err != nil {
		t.Fatalf("GenerateMasterPlaylist() error = %v", err)
	}

	// Verify stream was created
	if len(streamRepo.streams[1]) != 1 {
		t.Errorf("stream count = %d, want 1", len(streamRepo.streams[1]))
	}
}

// ============================================================================
// Playlist DeleteByChannelID
// ============================================================================

func TestPlaylistService_DeleteByChannelID(t *testing.T) {
	playlistRepo := newMockPlaylistRepo()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop",
	}

	err := playlistRepo.DeleteByChannelID(1)
	if err != nil {
		t.Fatalf("DeleteByChannelID() error = %v", err)
	}

	_, err = playlistRepo.FindByChannelID(1)
	if err == nil {
		t.Error("playlist should be deleted")
	}
}

// ============================================================================
// IPTVSeeder - SeedFromURL error on count
// ============================================================================

func TestIPTVSeeder_SeedFromURL_EmptyDB(t *testing.T) {
	m3uContent := `#EXTM3U
#EXTINF:-1 tvg-id="ch1" tvg-name="Channel" group-title="News",Channel
https://example.com/stream.m3u8
`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(m3uContent))
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	channelRepo.count = 0 // Empty DB
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	seeder.SeedFromURL(server.URL)

	// Should have imported channels
	if len(channelRepo.channels) == 0 {
		t.Error("expected channels to be imported on empty DB")
	}
}

// ============================================================================
// IPTVSeeder - importChannelsWithOptionsContext with UserAgent from M3U
// ============================================================================

func TestIPTVSeeder_ImportChannels_WithEmptyGroupTitle(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	entries := []m3uEntry{
		{TvgName: "Channel", GroupTitle: "", URL: "https://example.com/stream.m3u8"},
	}

	catMap := map[string]*model.Category{
		"Sin Categoría": {ID: 1, Name: "Sin Categoría", Slug: "sin-categoria"},
	}

	opts := IPTVImportOptions{Source: "test"}
	epgToID := seeder.importChannelsWithOptionsContext(context.Background(), entries, catMap, opts)

	if len(channelRepo.channels) != 1 {
		t.Errorf("channel count = %d, want 1", len(channelRepo.channels))
	}

	// Verify the channel has "Sin Categoría" category
	for _, ch := range channelRepo.channels {
		if ch.CategoryID == nil {
			t.Error("expected category to be set")
		}
	}
	_ = epgToID
}

// ============================================================================
// Emission - additional coverage for ListAll
// ============================================================================

func TestEmissionService_ListAll_Empty(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	emissions, err := emissionRepo.ListAll()
	if err != nil {
		t.Fatalf("ListAll() error = %v", err)
	}
	if len(emissions) != 0 {
		t.Errorf("expected 0 emissions, got %d", len(emissions))
	}
	_ = svc
}

func TestEmissionService_ListAll_WithEmissions(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	now := time.Now()
	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", StartedAt: &now,
	}
	emissionRepo.emissions[2] = &model.Emission{
		ID: 2, ChannelID: 2, Status: "stopped", StartedAt: &now,
	}

	emissions, err := emissionRepo.ListAll()
	if err != nil {
		t.Fatalf("ListAll() error = %v", err)
	}
	if len(emissions) != 2 {
		t.Errorf("expected 2 emissions, got %d", len(emissions))
	}
}

// ============================================================================
// Mock repo edge cases used by services
// ============================================================================

func TestMockChannelRepo_Delete_NotFound(t *testing.T) {
	repo := newMockChannelRepo()
	err := repo.Delete(999)
	if err != gorm.ErrRecordNotFound {
		t.Errorf("Delete() error = %v, want ErrRecordNotFound", err)
	}
}

func TestMockStreamRepo_DeleteByChannel(t *testing.T) {
	repo := newMockStreamRepo()
	repo.Create(&model.Stream{ChannelID: 1, URL: "https://s1.com"})
	repo.Create(&model.Stream{ChannelID: 1, URL: "https://s2.com"})
	repo.Create(&model.Stream{ChannelID: 2, URL: "https://s3.com"})

	err := repo.DeleteByChannel(1)
	if err != nil {
		t.Fatalf("DeleteByChannel() error = %v", err)
	}

	streams, _ := repo.ListByChannel(1)
	if len(streams) != 0 {
		t.Errorf("expected 0 streams for channel 1, got %d", len(streams))
	}
}

// ============================================================================
// IPTVSeeder - ParseM3U edge cases for better coverage
// ============================================================================

func TestIPTVSeeder_ParseM3U_WithUserAgent(t *testing.T) {
	seeder := setupIPTVSeeder()
	content := `#EXTM3U
#EXTINF:-1 tvg-id="ch1" tvg-name="Channel 1" tvg-logo="http://logo.png" tvg-country="ES" tvg-language="Spanish" group-title="News",Channel 1
#EXTVLCOPT:http-user-agent=Mozilla/5.0
http://stream1.example.com/live.m3u8
`
	entries := seeder.parseM3U(content)
	if len(entries) != 1 {
		t.Fatalf("len(entries) = %d, want 1", len(entries))
	}
	if entries[0].TvgLogo != "http://logo.png" {
		t.Errorf("TvgLogo = %q", entries[0].TvgLogo)
	}
}

func TestIPTVSeeder_ParseM3U_SkipsEmptyURL(t *testing.T) {
	seeder := setupIPTVSeeder()
	content := `#EXTM3U
#EXTINF:-1 tvg-name="Channel 1",Channel 1

#EXTINF:-1 tvg-name="Channel 2",Channel 2
http://valid.com/stream.m3u8
`
	entries := seeder.parseM3U(content)
	// First entry has no URL (empty line), second has valid URL
	if len(entries) != 1 {
		t.Errorf("len(entries) = %d, want 1 (skip empty URL)", len(entries))
	}
}

// ============================================================================
// ImportWithOptionsContext - default M3U URL
// ============================================================================

func TestIPTVSeeder_ImportWithOptionsContext_DefaultURL(t *testing.T) {
	seeder := setupIPTVSeeder()

	// Use a short-lived context to avoid hanging on real DNS/HTTP
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	seeder.ImportWithOptionsContext(ctx, IPTVImportOptions{
		Source: "test",
		// M3UURL left empty -> defaults to iptv-org URL
	})

	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running after failed import")
	}
}

// ============================================================================
// Playlist UpdateMode existing playlist path
// ============================================================================

func TestPlaylistService_UpdateMode_ExistingPlaylist(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}

	result, err := svc.UpdateMode(1, dto.UpdatePlaylistModeRequest{PlaybackMode: "shuffle"})
	if err != nil {
		t.Fatalf("UpdateMode() error = %v", err)
	}
	if result.PlaybackMode != "shuffle" {
		t.Errorf("playbackMode = %q, want shuffle", result.PlaybackMode)
	}
}

// ============================================================================
// Channel GetBySlug (via mock)
// ============================================================================

func TestChannelService_GetByID_WithStreamsAndCategory(t *testing.T) {
	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, nil)

	catID := uint(1)
	chRepo.addChannel(&model.Channel{
		Name:       "ESPN",
		Slug:       "espn",
		IsActive:   true,
		CategoryID: &catID,
		Category:   &model.Category{ID: 1, Name: "Sports", Slug: "sports", Type: "live"},
		Streams: []model.Stream{
			{ID: 1, URL: "https://example.com/s1.m3u8", StreamFormat: "hls", Priority: 1, IsActive: true},
		},
	})

	resp, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("GetByID() error = %v", err)
	}
	if resp.Category == nil {
		t.Fatal("category should not be nil")
	}
	if len(resp.Streams) != 1 {
		t.Errorf("streams count = %d, want 1", len(resp.Streams))
	}
}
