package service

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock Playlist Repository ---

type mockPlaylistRepo struct {
	playlists map[uint]*model.Playlist // keyed by channelID
	items     map[uint]*model.PlaylistItem
	nextPID   uint
	nextIID   uint
}

func newMockPlaylistRepo() *mockPlaylistRepo {
	return &mockPlaylistRepo{
		playlists: make(map[uint]*model.Playlist),
		items:     make(map[uint]*model.PlaylistItem),
		nextPID:   1,
		nextIID:   1,
	}
}

func (m *mockPlaylistRepo) FindByChannelID(channelID uint) (*model.Playlist, error) {
	p, ok := m.playlists[channelID]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	// Rebuild items list
	var items []model.PlaylistItem
	for _, item := range m.items {
		if item.PlaylistID == p.ID {
			items = append(items, *item)
		}
	}
	p.Items = items
	return p, nil
}

func (m *mockPlaylistRepo) Create(playlist *model.Playlist) error {
	playlist.ID = m.nextPID
	m.nextPID++
	m.playlists[playlist.ChannelID] = playlist
	return nil
}

func (m *mockPlaylistRepo) Update(playlist *model.Playlist) error {
	m.playlists[playlist.ChannelID] = playlist
	return nil
}

func (m *mockPlaylistRepo) AddItem(item *model.PlaylistItem) error {
	item.ID = m.nextIID
	m.nextIID++
	m.items[item.ID] = item
	return nil
}

func (m *mockPlaylistRepo) RemoveItem(itemID uint) error {
	delete(m.items, itemID)
	return nil
}

func (m *mockPlaylistRepo) FindItemByID(itemID uint) (*model.PlaylistItem, error) {
	item, ok := m.items[itemID]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return item, nil
}

func (m *mockPlaylistRepo) ReorderItems(playlistID uint, items []struct {
	ID        uint
	SortOrder int
}) error {
	for _, reorder := range items {
		if item, ok := m.items[reorder.ID]; ok {
			item.SortOrder = reorder.SortOrder
		}
	}
	return nil
}

func (m *mockPlaylistRepo) DeleteByChannelID(channelID uint) error {
	delete(m.playlists, channelID)
	return nil
}

// --- Mock LocalMedia Repository for Playlist ---

type mockLocalMediaRepoForPlaylist struct {
	media map[uint]*model.LocalMedia
}

func newMockLocalMediaRepoForPlaylist() *mockLocalMediaRepoForPlaylist {
	return &mockLocalMediaRepoForPlaylist{media: make(map[uint]*model.LocalMedia)}
}

func (m *mockLocalMediaRepoForPlaylist) Create(media *model.LocalMedia) error { return nil }
func (m *mockLocalMediaRepoForPlaylist) FindByID(id uint) (*model.LocalMedia, error) {
	media, ok := m.media[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return media, nil
}
func (m *mockLocalMediaRepoForPlaylist) List(page, perPage int) ([]model.LocalMedia, int64, error) {
	return nil, 0, nil
}
func (m *mockLocalMediaRepoForPlaylist) Update(media *model.LocalMedia) error { return nil }
func (m *mockLocalMediaRepoForPlaylist) UpdateStatus(id uint, status string, progress int, errorMsg string) error {
	return nil
}
func (m *mockLocalMediaRepoForPlaylist) Delete(id uint) error { return nil }
func (m *mockLocalMediaRepoForPlaylist) FindPendingTranscodes() ([]model.LocalMedia, error) {
	return nil, nil
}
func (m *mockLocalMediaRepoForPlaylist) ListRecent(limit int) ([]model.LocalMedia, error) {
	return nil, nil
}

// --- Mock Channel + Stream Repos for Playlist ---

type mockChannelRepoForPlaylist struct {
	channels map[uint]*model.Channel
}

func newMockChannelRepoForPlaylist() *mockChannelRepoForPlaylist {
	return &mockChannelRepoForPlaylist{channels: make(map[uint]*model.Channel)}
}

func (m *mockChannelRepoForPlaylist) FindByID(id uint) (*model.Channel, error) {
	c, ok := m.channels[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}
func (m *mockChannelRepoForPlaylist) FindBySlug(string) (*model.Channel, error) {
	return nil, gorm.ErrRecordNotFound
}
func (m *mockChannelRepoForPlaylist) List(int, int) ([]model.Channel, int64, error) {
	return nil, 0, nil
}
func (m *mockChannelRepoForPlaylist) ListActive(int, int, string, *uint) ([]model.Channel, int64, error) {
	return nil, 0, nil
}
func (m *mockChannelRepoForPlaylist) Create(*model.Channel) error         { return nil }
func (m *mockChannelRepoForPlaylist) Update(*model.Channel) error         { return nil }
func (m *mockChannelRepoForPlaylist) Delete(uint) error                   { return nil }
func (m *mockChannelRepoForPlaylist) Count() (int64, error)               { return 0, nil }
func (m *mockChannelRepoForPlaylist) CountActive() (int64, error)         { return 0, nil }
func (m *mockChannelRepoForPlaylist) CountBySource(string) (int64, error) { return 0, nil }
func (m *mockChannelRepoForPlaylist) DeleteBySource(string) error         { return nil }

type mockStreamRepoForPlaylist struct {
	streams map[uint][]model.Stream
	nextID  uint
}

func newMockStreamRepoForPlaylist() *mockStreamRepoForPlaylist {
	return &mockStreamRepoForPlaylist{streams: make(map[uint][]model.Stream), nextID: 1}
}

func (m *mockStreamRepoForPlaylist) FindByID(id uint) (*model.Stream, error) {
	return nil, gorm.ErrRecordNotFound
}
func (m *mockStreamRepoForPlaylist) ListByChannel(channelID uint) ([]model.Stream, error) {
	return m.streams[channelID], nil
}
func (m *mockStreamRepoForPlaylist) Create(stream *model.Stream) error {
	stream.ID = m.nextID
	m.nextID++
	m.streams[stream.ChannelID] = append(m.streams[stream.ChannelID], *stream)
	return nil
}
func (m *mockStreamRepoForPlaylist) Update(stream *model.Stream) error { return nil }
func (m *mockStreamRepoForPlaylist) Delete(id uint) error              { return nil }
func (m *mockStreamRepoForPlaylist) DeleteByChannel(channelID uint) error {
	delete(m.streams, channelID)
	return nil
}

// --- Helpers ---

func setupPlaylistService() (*PlaylistService, *mockPlaylistRepo, *mockLocalMediaRepoForPlaylist) {
	playlistRepo := newMockPlaylistRepo()
	mediaRepo := newMockLocalMediaRepoForPlaylist()
	channelRepo := newMockChannelRepoForPlaylist()
	streamRepo := newMockStreamRepoForPlaylist()
	svc := NewPlaylistService(playlistRepo, mediaRepo, channelRepo, streamRepo, "/tmp/media")
	return svc, playlistRepo, mediaRepo
}

// --- Tests ---

func TestPlaylistService_GetByChannelID_Creates(t *testing.T) {
	svc, _, _ := setupPlaylistService()

	// Should auto-create a playlist
	result, err := svc.GetByChannelID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ChannelID != 1 {
		t.Errorf("channelID = %d, want 1", result.ChannelID)
	}
	if result.PlaybackMode != "loop" {
		t.Errorf("playbackMode = %q, want %q", result.PlaybackMode, "loop")
	}
}

func TestPlaylistService_GetByChannelID_Existing(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "shuffle", IsActive: true,
	}

	result, err := svc.GetByChannelID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.PlaybackMode != "shuffle" {
		t.Errorf("playbackMode = %q, want %q", result.PlaybackMode, "shuffle")
	}
}

func TestPlaylistService_AddItem(t *testing.T) {
	svc, playlistRepo, mediaRepo := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	mediaRepo.media[10] = &model.LocalMedia{ID: 10, Status: "completed", OriginalFilename: "video.mp4"}

	req := dto.AddPlaylistItemRequest{LocalMediaID: 10, SortOrder: 1}
	result, err := svc.AddItem(1, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Items) != 1 {
		t.Errorf("items count = %d, want 1", len(result.Items))
	}
}

func TestPlaylistService_AddItem_MediaNotFound(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}

	req := dto.AddPlaylistItemRequest{LocalMediaID: 999, SortOrder: 1}
	_, err := svc.AddItem(1, req)
	if err == nil {
		t.Error("expected error for missing media")
	}
}

func TestPlaylistService_AddItem_NotCompleted(t *testing.T) {
	svc, playlistRepo, mediaRepo := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	mediaRepo.media[10] = &model.LocalMedia{ID: 10, Status: "processing"}

	req := dto.AddPlaylistItemRequest{LocalMediaID: 10, SortOrder: 1}
	_, err := svc.AddItem(1, req)
	if err == nil {
		t.Error("expected error for non-completed media")
	}
}

func TestPlaylistService_RemoveItem(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	playlistRepo.items[5] = &model.PlaylistItem{ID: 5, PlaylistID: 1, LocalMediaID: 10}

	result, err := svc.RemoveItem(1, 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Items) != 0 {
		t.Errorf("items count = %d, want 0", len(result.Items))
	}
}

func TestPlaylistService_RemoveItem_NotBelonging(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	// Item belongs to a different playlist
	playlistRepo.items[5] = &model.PlaylistItem{ID: 5, PlaylistID: 99, LocalMediaID: 10}

	_, err := svc.RemoveItem(1, 5)
	if err == nil {
		t.Error("expected error for item not belonging to playlist")
	}
}

func TestPlaylistService_UpdateMode_Valid(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}

	for _, mode := range []string{"loop", "once", "shuffle"} {
		t.Run(fmt.Sprintf("mode_%s", mode), func(t *testing.T) {
			req := dto.UpdatePlaylistModeRequest{PlaybackMode: mode}
			result, err := svc.UpdateMode(1, req)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.PlaybackMode != mode {
				t.Errorf("playbackMode = %q, want %q", result.PlaybackMode, mode)
			}
		})
	}
}

func TestPlaylistService_UpdateMode_Invalid(t *testing.T) {
	svc, _, _ := setupPlaylistService()

	req := dto.UpdatePlaylistModeRequest{PlaybackMode: "random"}
	_, err := svc.UpdateMode(1, req)
	if err == nil {
		t.Error("expected error for invalid mode")
	}
}

func TestPlaylistService_UpdateMode_CreatesPlaylist(t *testing.T) {
	svc, _, _ := setupPlaylistService()

	// No playlist exists yet; should auto-create
	req := dto.UpdatePlaylistModeRequest{PlaybackMode: "once"}
	result, err := svc.UpdateMode(1, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.PlaybackMode != "once" {
		t.Errorf("playbackMode = %q, want %q", result.PlaybackMode, "once")
	}
}

func TestPlaylistService_Reorder(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	playlistRepo.items[1] = &model.PlaylistItem{ID: 1, PlaylistID: 1, SortOrder: 0}
	playlistRepo.items[2] = &model.PlaylistItem{ID: 2, PlaylistID: 1, SortOrder: 1}

	req := dto.ReorderPlaylistRequest{
		Items: []dto.ReorderItem{
			{ID: 1, SortOrder: 1},
			{ID: 2, SortOrder: 0},
		},
	}
	_, err := svc.Reorder(1, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify reorder happened
	if playlistRepo.items[1].SortOrder != 1 {
		t.Errorf("item 1 sort = %d, want 1", playlistRepo.items[1].SortOrder)
	}
	if playlistRepo.items[2].SortOrder != 0 {
		t.Errorf("item 2 sort = %d, want 0", playlistRepo.items[2].SortOrder)
	}
}

// --- GenerateMasterPlaylist tests ---

func TestPlaylistService_GenerateMasterPlaylist_NoPlaylist(t *testing.T) {
	svc, _, _ := setupPlaylistService()

	_, err := svc.GenerateMasterPlaylist(999)
	if err == nil {
		t.Error("expected error for nonexistent playlist")
	}
}

func TestPlaylistService_GenerateMasterPlaylist_EmptyPlaylist(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	// No items in playlist

	_, err := svc.GenerateMasterPlaylist(1)
	if err == nil {
		t.Error("expected error for empty playlist")
	}
	if err.Error() != "la playlist no tiene items" {
		t.Errorf("error = %q, want %q", err.Error(), "la playlist no tiene items")
	}
}

func TestPlaylistService_GenerateMasterPlaylist_NilLocalMedia(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	// Add item with nil LocalMedia
	playlistRepo.items[1] = &model.PlaylistItem{
		ID: 1, PlaylistID: 1, LocalMediaID: 10, SortOrder: 0,
		// LocalMedia is nil
	}

	_, err := svc.GenerateMasterPlaylist(1)
	if err == nil {
		t.Error("expected error for nil LocalMedia")
	}
}

func TestPlaylistService_GenerateMasterPlaylist_MediaNotCompleted(t *testing.T) {
	svc, playlistRepo, _ := setupPlaylistService()
	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}
	playlistRepo.items[1] = &model.PlaylistItem{
		ID: 1, PlaylistID: 1, LocalMediaID: 10, SortOrder: 0,
		LocalMedia: &model.LocalMedia{ID: 10, Status: "processing", OriginalFilename: "video.mp4"},
	}

	_, err := svc.GenerateMasterPlaylist(1)
	if err == nil {
		t.Error("expected error for non-completed media")
	}
}

func TestPlaylistService_GenerateMasterPlaylist_Success(t *testing.T) {
	playlistRepo := newMockPlaylistRepo()
	mediaRepo := newMockLocalMediaRepoForPlaylist()
	channelRepo := newMockChannelRepoForPlaylist()
	streamRepo := newMockStreamRepoForPlaylist()

	// Use a temp dir for mediaPath
	tmpDir := t.TempDir()
	svc := NewPlaylistService(playlistRepo, mediaRepo, channelRepo, streamRepo, tmpDir)

	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}

	media := &model.LocalMedia{ID: 10, Status: "completed", OriginalFilename: "video.mp4"}
	playlistRepo.items[1] = &model.PlaylistItem{
		ID: 1, PlaylistID: 1, LocalMediaID: 10, SortOrder: 0,
		LocalMedia: media,
	}

	// Create a fake HLS index file for the media
	hlsDir := fmt.Sprintf("%s/local/10", tmpDir)
	if err := os.MkdirAll(hlsDir, 0755); err != nil {
		t.Fatalf("MkdirAll error: %v", err)
	}
	indexContent := `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000000,
segment_0.ts
#EXTINF:5.500000,
segment_1.ts
#EXT-X-ENDLIST
`
	if err := os.WriteFile(hlsDir+"/index.m3u8", []byte(indexContent), 0644); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}

	result, err := svc.GenerateMasterPlaylist(1)
	if err != nil {
		t.Fatalf("GenerateMasterPlaylist() error = %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}

	// Verify the master playlist file was written
	masterPath := fmt.Sprintf("%s/channels/1/playlist.m3u8", tmpDir)
	content, readErr := os.ReadFile(masterPath)
	if readErr != nil {
		t.Fatalf("ReadFile error: %v", readErr)
	}

	// Verify playlist content
	contentStr := string(content)
	if !strings.Contains(contentStr, "#EXTM3U") {
		t.Error("master playlist should contain #EXTM3U")
	}
	if !strings.Contains(contentStr, "#EXT-X-TARGETDURATION:6") {
		t.Error("master playlist should contain target duration from source")
	}
	if !strings.Contains(contentStr, "/media/local/10/segment_0.ts") {
		t.Error("master playlist should contain rewritten segment URL")
	}
	if !strings.Contains(contentStr, "#EXT-X-ENDLIST") {
		t.Error("master playlist should contain ENDLIST")
	}

	// Verify stream was created
	if len(streamRepo.streams[1]) != 1 {
		t.Errorf("stream count = %d, want 1", len(streamRepo.streams[1]))
	}
	if len(streamRepo.streams[1]) > 0 {
		stream := streamRepo.streams[1][0]
		expectedURL := fmt.Sprintf("/media/channels/1/playlist.m3u8")
		if stream.URL != expectedURL {
			t.Errorf("stream URL = %q, want %q", stream.URL, expectedURL)
		}
	}
}

func TestPlaylistService_GenerateMasterPlaylist_MultipleItems(t *testing.T) {
	playlistRepo := newMockPlaylistRepo()
	mediaRepo := newMockLocalMediaRepoForPlaylist()
	channelRepo := newMockChannelRepoForPlaylist()
	streamRepo := newMockStreamRepoForPlaylist()

	tmpDir := t.TempDir()
	svc := NewPlaylistService(playlistRepo, mediaRepo, channelRepo, streamRepo, tmpDir)

	playlistRepo.playlists[1] = &model.Playlist{
		ID: 1, ChannelID: 1, PlaybackMode: "loop", IsActive: true,
	}

	media1 := &model.LocalMedia{ID: 10, Status: "completed", OriginalFilename: "video1.mp4"}
	media2 := &model.LocalMedia{ID: 20, Status: "completed", OriginalFilename: "video2.mp4"}

	playlistRepo.items[1] = &model.PlaylistItem{
		ID: 1, PlaylistID: 1, LocalMediaID: 10, SortOrder: 0, LocalMedia: media1,
	}
	playlistRepo.items[2] = &model.PlaylistItem{
		ID: 2, PlaylistID: 1, LocalMediaID: 20, SortOrder: 1, LocalMedia: media2,
	}

	// Create fake HLS files for both media
	for _, mediaID := range []int{10, 20} {
		hlsDir := fmt.Sprintf("%s/local/%d", tmpDir, mediaID)
		os.MkdirAll(hlsDir, 0755)
		indexContent := fmt.Sprintf(`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000000,
segment_0.ts
#EXT-X-ENDLIST
`)
		os.WriteFile(hlsDir+"/index.m3u8", []byte(indexContent), 0644)
	}

	result, err := svc.GenerateMasterPlaylist(1)
	if err != nil {
		t.Fatalf("GenerateMasterPlaylist() error = %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}

	// Verify discontinuity marker between items
	masterPath := fmt.Sprintf("%s/channels/1/playlist.m3u8", tmpDir)
	content, _ := os.ReadFile(masterPath)
	contentStr := string(content)

	if !strings.Contains(contentStr, "#EXT-X-DISCONTINUITY") {
		t.Error("master playlist should contain discontinuity between items")
	}
	if !strings.Contains(contentStr, "/media/local/10/segment_0.ts") {
		t.Error("should contain segment from media 10")
	}
	if !strings.Contains(contentStr, "/media/local/20/segment_0.ts") {
		t.Error("should contain segment from media 20")
	}
}

func TestPlaylistService_GenerateMasterPlaylist_MissingHLSFile(t *testing.T) {
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

	// Don't create the HLS file -> should error
	_, err := svc.GenerateMasterPlaylist(1)
	if err == nil {
		t.Error("expected error when HLS file is missing")
	}
}

func TestPlaylistService_GenerateMasterPlaylist_ExistingStream(t *testing.T) {
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

	// Pre-create a local-emission stream (existing)
	streamRepo.streams[1] = []model.Stream{
		{ID: 1, ChannelID: 1, URL: "/media/channels/1/old-playlist.m3u8", StreamFormat: "hls", IsActive: true},
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

	// The mock Update doesn't actually modify the stream list, but the code path
	// for finding and updating an existing stream is exercised without error
}

func TestPlaylistService_GenerateMasterPlaylist_DefaultTargetDuration(t *testing.T) {
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

	// Create HLS file WITHOUT TARGETDURATION (should default to 10)
	hlsDir := fmt.Sprintf("%s/local/10", tmpDir)
	os.MkdirAll(hlsDir, 0755)
	os.WriteFile(hlsDir+"/index.m3u8", []byte(`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000000,
segment_0.ts
#EXT-X-ENDLIST
`), 0644)

	_, err := svc.GenerateMasterPlaylist(1)
	if err != nil {
		t.Fatalf("GenerateMasterPlaylist() error = %v", err)
	}

	masterPath := fmt.Sprintf("%s/channels/1/playlist.m3u8", tmpDir)
	content, _ := os.ReadFile(masterPath)
	contentStr := string(content)

	if !strings.Contains(contentStr, "#EXT-X-TARGETDURATION:10") {
		t.Error("should default to TARGETDURATION:10 when source has none")
	}
}
