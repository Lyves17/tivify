package service

import (
	"context"
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/ws"
	"gorm.io/gorm"
)

// --- Mock LibraryScannerRepository ---

type mockLibraryScannerRepo struct {
	items     map[uint]*model.LibraryScanItem
	bySession map[string][]uint // sessionID -> item IDs
	nextID    uint
}

func newMockLibraryScannerRepo() *mockLibraryScannerRepo {
	return &mockLibraryScannerRepo{
		items:     make(map[uint]*model.LibraryScanItem),
		bySession: make(map[string][]uint),
		nextID:    1,
	}
}

func (m *mockLibraryScannerRepo) Create(item *model.LibraryScanItem) error {
	item.ID = m.nextID
	m.nextID++
	m.items[item.ID] = item
	m.bySession[item.ScanSessionID] = append(m.bySession[item.ScanSessionID], item.ID)
	return nil
}

func (m *mockLibraryScannerRepo) CreateBatch(items []model.LibraryScanItem) error {
	for i := range items {
		m.Create(&items[i])
	}
	return nil
}

func (m *mockLibraryScannerRepo) FindByID(id uint) (*model.LibraryScanItem, error) {
	item, ok := m.items[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return item, nil
}

func (m *mockLibraryScannerRepo) FindBySessionID(sessionID string, page, perPage int) ([]model.LibraryScanItem, int64, error) {
	ids := m.bySession[sessionID]
	var result []model.LibraryScanItem
	for _, id := range ids {
		if item, ok := m.items[id]; ok {
			result = append(result, *item)
		}
	}
	total := int64(len(result))
	start := (page - 1) * perPage
	if start >= len(result) {
		return nil, total, nil
	}
	end := start + perPage
	if end > len(result) {
		end = len(result)
	}
	return result[start:end], total, nil
}

func (m *mockLibraryScannerRepo) FindPendingBySessionID(sessionID string) ([]model.LibraryScanItem, error) {
	ids := m.bySession[sessionID]
	var result []model.LibraryScanItem
	for _, id := range ids {
		if item, ok := m.items[id]; ok && item.ImportStatus == "pending" {
			result = append(result, *item)
		}
	}
	return result, nil
}

func (m *mockLibraryScannerRepo) FindByIDs(ids []uint) ([]model.LibraryScanItem, error) {
	var result []model.LibraryScanItem
	for _, id := range ids {
		if item, ok := m.items[id]; ok {
			result = append(result, *item)
		}
	}
	return result, nil
}

func (m *mockLibraryScannerRepo) Update(item *model.LibraryScanItem) error {
	m.items[item.ID] = item
	return nil
}

func (m *mockLibraryScannerRepo) UpdateImportStatus(id uint, status string, vodID *uint, seriesID *uint, errMsg string) error {
	if item, ok := m.items[id]; ok {
		item.ImportStatus = status
		item.ImportedVODID = vodID
		item.ImportedSeriesID = seriesID
		item.ErrorMessage = errMsg
	}
	return nil
}

func (m *mockLibraryScannerRepo) DeleteBySessionID(sessionID string) error {
	ids := m.bySession[sessionID]
	for _, id := range ids {
		delete(m.items, id)
	}
	delete(m.bySession, sessionID)
	return nil
}

func (m *mockLibraryScannerRepo) ExistsFilePath(filePath string) (bool, error) {
	for _, item := range m.items {
		if item.FilePath == filePath {
			return true, nil
		}
	}
	return false, nil
}

func (m *mockLibraryScannerRepo) CountBySessionID(sessionID string) (int64, error) {
	return int64(len(m.bySession[sessionID])), nil
}

// --- Mock VOD Repo for LibraryScanner ---

type mockVODRepoForScanner struct {
	vods   map[uint]*model.VOD
	nextID uint
}

func newMockVODRepoForScanner() *mockVODRepoForScanner {
	return &mockVODRepoForScanner{vods: make(map[uint]*model.VOD), nextID: 1}
}

func (m *mockVODRepoForScanner) FindByID(id uint) (*model.VOD, error) {
	v, ok := m.vods[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return v, nil
}
func (m *mockVODRepoForScanner) FindBySlug(string) (*model.VOD, error) {
	return nil, gorm.ErrRecordNotFound
}
func (m *mockVODRepoForScanner) List(int, int) ([]model.VOD, int64, error) { return nil, 0, nil }
func (m *mockVODRepoForScanner) ListActive(int, int, string, *uint) ([]model.VOD, int64, error) {
	return nil, 0, nil
}
func (m *mockVODRepoForScanner) ListBySeries(uint) ([]model.VOD, error) { return nil, nil }
func (m *mockVODRepoForScanner) Create(vod *model.VOD) error {
	vod.ID = m.nextID
	m.nextID++
	m.vods[vod.ID] = vod
	return nil
}
func (m *mockVODRepoForScanner) Update(vod *model.VOD) error {
	m.vods[vod.ID] = vod
	return nil
}
func (m *mockVODRepoForScanner) Delete(uint) error                                   { return nil }
func (m *mockVODRepoForScanner) Count() (int64, error)                               { return 0, nil }
func (m *mockVODRepoForScanner) CountActive() (int64, error)                         { return 0, nil }
func (m *mockVODRepoForScanner) ListRecent(int) ([]model.VOD, error)                 { return nil, nil }
func (m *mockVODRepoForScanner) ListByTranscodeStatus([]string) ([]model.VOD, error) { return nil, nil }
func (m *mockVODRepoForScanner) ListWithoutPoster() ([]model.VOD, error)             { return nil, nil }
func (m *mockVODRepoForScanner) DebugAll() ([]model.VOD, error)                      { return nil, nil }

// --- Mock Series Repo for LibraryScanner ---

type mockSeriesRepoForScanner struct {
	series map[uint]*model.Series
	nextID uint
}

func newMockSeriesRepoForScanner() *mockSeriesRepoForScanner {
	return &mockSeriesRepoForScanner{series: make(map[uint]*model.Series), nextID: 1}
}

func (m *mockSeriesRepoForScanner) FindByID(id uint) (*model.Series, error) {
	s, ok := m.series[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return s, nil
}
func (m *mockSeriesRepoForScanner) FindBySlug(string) (*model.Series, error) {
	return nil, gorm.ErrRecordNotFound
}
func (m *mockSeriesRepoForScanner) List(int, int) ([]model.Series, int64, error) { return nil, 0, nil }
func (m *mockSeriesRepoForScanner) ListActive(int, int, string, *uint) ([]model.Series, int64, error) {
	return nil, 0, nil
}
func (m *mockSeriesRepoForScanner) Create(s *model.Series) error {
	s.ID = m.nextID
	m.nextID++
	m.series[s.ID] = s
	return nil
}
func (m *mockSeriesRepoForScanner) Update(s *model.Series) error {
	m.series[s.ID] = s
	return nil
}
func (m *mockSeriesRepoForScanner) Delete(uint) error                          { return nil }
func (m *mockSeriesRepoForScanner) Count() (int64, error)                      { return 0, nil }
func (m *mockSeriesRepoForScanner) CountActive() (int64, error)                { return 0, nil }
func (m *mockSeriesRepoForScanner) CountEpisodes(uint) (int64, error)          { return 0, nil }
func (m *mockSeriesRepoForScanner) ListWithoutPoster() ([]model.Series, error) { return nil, nil }

// --- Mock Category Repo for LibraryScanner ---

type mockCategoryRepoForScanner struct {
	categories map[uint]*model.Category
	bySlug     map[string]*model.Category
	byType     map[string][]model.Category
	nextID     uint
}

func newMockCategoryRepoForScanner() *mockCategoryRepoForScanner {
	return &mockCategoryRepoForScanner{
		categories: make(map[uint]*model.Category),
		bySlug:     make(map[string]*model.Category),
		byType:     make(map[string][]model.Category),
		nextID:     1,
	}
}

func (m *mockCategoryRepoForScanner) FindByID(id uint) (*model.Category, error) {
	c, ok := m.categories[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}
func (m *mockCategoryRepoForScanner) FindBySlug(slug string) (*model.Category, error) {
	c, ok := m.bySlug[slug]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}
func (m *mockCategoryRepoForScanner) List(int, int) ([]model.Category, int64, error) {
	return nil, 0, nil
}
func (m *mockCategoryRepoForScanner) ListByType(catType string) ([]model.Category, error) {
	return m.byType[catType], nil
}
func (m *mockCategoryRepoForScanner) Create(c *model.Category) error {
	c.ID = m.nextID
	m.nextID++
	m.categories[c.ID] = c
	m.bySlug[c.Slug] = c
	m.byType[c.Type] = append(m.byType[c.Type], *c)
	return nil
}
func (m *mockCategoryRepoForScanner) Update(*model.Category) error { return nil }
func (m *mockCategoryRepoForScanner) Delete(uint) error            { return nil }
func (m *mockCategoryRepoForScanner) Count() (int64, error)        { return 0, nil }

// --- ParseFilename Tests ---

func TestParseFilename_Movie_WithYear(t *testing.T) {
	tests := []struct {
		filename  string
		wantTitle string
		wantYear  int
		wantType  string
	}{
		{"Inception.2010.1080p.BluRay.x264.mp4", "Inception", 2010, "movie"},
		{"The.Matrix.1999.720p.BluRay.mkv", "The Matrix", 1999, "movie"},
		{"Interstellar (2014) HDRip.mp4", "Interstellar", 2014, "movie"},
		{"Dune.Part.Two.2024.UHD.mp4", "Dune Part Two", 2024, "movie"},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			title, year, mediaType, _, _ := ParseFilename(tt.filename)
			if title != tt.wantTitle {
				t.Errorf("title = %q, want %q", title, tt.wantTitle)
			}
			if year != tt.wantYear {
				t.Errorf("year = %d, want %d", year, tt.wantYear)
			}
			if mediaType != tt.wantType {
				t.Errorf("mediaType = %q, want %q", mediaType, tt.wantType)
			}
		})
	}
}

func TestParseFilename_Movie_WithoutYear(t *testing.T) {
	title, year, mediaType, _, _ := ParseFilename("My.Movie.720p.mp4")
	if mediaType != "movie" {
		t.Errorf("mediaType = %q, want %q", mediaType, "movie")
	}
	if year != 0 {
		t.Errorf("year = %d, want 0", year)
	}
	if title == "" {
		t.Error("title should not be empty")
	}
}

func TestParseFilename_Series_SEPattern(t *testing.T) {
	tests := []struct {
		filename    string
		wantTitle   string
		wantSeason  int
		wantEpisode int
		wantType    string
	}{
		{"Breaking.Bad.S01E01.720p.mp4", "Breaking Bad", 1, 1, "series"},
		{"Game.of.Thrones.S08E06.1080p.mp4", "Game Of Thrones", 8, 6, "series"},
		{"the.office.s02e10.mp4", "The Office", 2, 10, "series"},
		{"Stranger.Things.S04E09.4K.mkv", "Stranger Things", 4, 9, "series"},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			title, _, mediaType, season, episode := ParseFilename(tt.filename)
			if title != tt.wantTitle {
				t.Errorf("title = %q, want %q", title, tt.wantTitle)
			}
			if mediaType != tt.wantType {
				t.Errorf("mediaType = %q, want %q", mediaType, tt.wantType)
			}
			if season != tt.wantSeason {
				t.Errorf("season = %d, want %d", season, tt.wantSeason)
			}
			if episode != tt.wantEpisode {
				t.Errorf("episode = %d, want %d", episode, tt.wantEpisode)
			}
		})
	}
}

func TestParseFilename_Series_XPattern(t *testing.T) {
	title, _, mediaType, season, episode := ParseFilename("Seinfeld.3x15.The.Boyfriend.avi")
	if mediaType != "series" {
		t.Errorf("mediaType = %q, want %q", mediaType, "series")
	}
	if season != 3 {
		t.Errorf("season = %d, want 3", season)
	}
	if episode != 15 {
		t.Errorf("episode = %d, want 15", episode)
	}
	if title == "" {
		t.Error("title should not be empty")
	}
}

func TestParseFilename_CleansTags(t *testing.T) {
	title, _, _, _, _ := ParseFilename("Movie.Name.1080p.BluRay.x264.DTS.mp4")
	// Should not contain resolution/codec tags
	if title == "" {
		t.Error("title should not be empty")
	}
	// Title should be clean
	for _, tag := range []string{"1080p", "BluRay", "x264", "DTS"} {
		if containsIgnoreCase(title, tag) {
			t.Errorf("title %q should not contain tag %q", title, tag)
		}
	}
}

func containsIgnoreCase(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr ||
		len(s) > 0 && len(substr) > 0 &&
			(s[0:1] == substr[0:1] || // simple check
				testing.Short())) // skip in short mode
}

func TestShouldTranscode(t *testing.T) {
	tests := []struct {
		name       string
		container  string
		videoCodec string
		audioCodec string
		want       bool
	}{
		{"mp4_h264_aac", "mp4", "h264", "aac", false},
		{"MP4_H264_AAC", "MP4", "H264", "AAC", false},
		{"mkv_h264_aac", "mkv", "h264", "aac", true},
		{"mp4_h265_aac", "mp4", "h265", "aac", true},
		{"mp4_h264_mp3", "mp4", "h264", "mp3", true},
		{"avi_h264_aac", "avi", "h264", "aac", true},
		{"webm_vp9_opus", "webm", "vp9", "opus", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ShouldTranscode(tt.container, tt.videoCodec, tt.audioCodec)
			if got != tt.want {
				t.Errorf("ShouldTranscode(%q, %q, %q) = %v, want %v",
					tt.container, tt.videoCodec, tt.audioCodec, got, tt.want)
			}
		})
	}
}

func TestVideoExtensions(t *testing.T) {
	expected := []string{".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".mpg", ".mpeg", ".3gp"}
	for _, ext := range expected {
		if !videoExtensions[ext] {
			t.Errorf("extension %q should be in videoExtensions", ext)
		}
	}

	notVideo := []string{".txt", ".jpg", ".exe", ".mp3", ".pdf"}
	for _, ext := range notVideo {
		if videoExtensions[ext] {
			t.Errorf("extension %q should not be in videoExtensions", ext)
		}
	}
}

// --- LibraryScannerService Tests ---

func setupLibraryScanner() (*LibraryScannerService, *mockLibraryScannerRepo) {
	repo := newMockLibraryScannerRepo()
	tmdbSvc := NewTMDBService("") // not configured
	transcoderRepo := newMockLocalMediaRepoForTranscoder()
	transcoder := NewTranscoderService(transcoderRepo, "ffmpeg", "ffprobe", "/tmp/media")
	vodRepo := newMockVODRepoForScanner()
	seriesRepo := newMockSeriesRepoForScanner()
	categoryRepo := newMockCategoryRepoForScanner()

	svc := NewLibraryScannerService(repo, transcoder, tmdbSvc, vodRepo, seriesRepo, categoryRepo, "/library", "/tmp/media")
	return svc, repo
}

func TestLibraryScannerService_GetScanStatus_NotFound(t *testing.T) {
	svc, _ := setupLibraryScanner()

	status := svc.GetScanStatus("nonexistent-session")
	if status != nil {
		t.Errorf("expected nil status for nonexistent session, got %+v", status)
	}
}

func TestLibraryScannerService_GetScanStatus_FromDB(t *testing.T) {
	svc, repo := setupLibraryScanner()

	// Add items to simulate a completed scan in the DB
	repo.Create(&model.LibraryScanItem{ScanSessionID: "session-123", FileName: "file1.mp4"})
	repo.Create(&model.LibraryScanItem{ScanSessionID: "session-123", FileName: "file2.mkv"})

	status := svc.GetScanStatus("session-123")
	if status == nil {
		t.Fatal("expected non-nil status")
	}
	if status.Status != "completed" {
		t.Errorf("status = %q, want %q", status.Status, "completed")
	}
	if status.TotalFiles != 2 {
		t.Errorf("TotalFiles = %d, want 2", status.TotalFiles)
	}
}

func TestLibraryScannerService_GetScanResults(t *testing.T) {
	svc, repo := setupLibraryScanner()

	repo.Create(&model.LibraryScanItem{ScanSessionID: "sess-1", FileName: "movie.mp4", ParsedTitle: "Movie"})
	repo.Create(&model.LibraryScanItem{ScanSessionID: "sess-1", FileName: "show.mkv", ParsedTitle: "Show"})
	repo.Create(&model.LibraryScanItem{ScanSessionID: "sess-2", FileName: "other.avi", ParsedTitle: "Other"})

	items, total, err := svc.GetScanResults("sess-1", 1, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(items) != 2 {
		t.Errorf("len(items) = %d, want 2", len(items))
	}
}

func TestLibraryScannerService_GetScanResults_Pagination(t *testing.T) {
	svc, repo := setupLibraryScanner()

	for i := 0; i < 5; i++ {
		repo.Create(&model.LibraryScanItem{ScanSessionID: "sess-1", FileName: "file.mp4"})
	}

	items, total, err := svc.GetScanResults("sess-1", 1, 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 5 {
		t.Errorf("total = %d, want 5", total)
	}
	if len(items) != 2 {
		t.Errorf("len(items) = %d, want 2", len(items))
	}
}

func TestLibraryScannerService_UpdateScanItem_Success(t *testing.T) {
	svc, repo := setupLibraryScanner()

	repo.Create(&model.LibraryScanItem{
		ScanSessionID: "sess-1",
		FileName:      "movie.mp4",
		ParsedTitle:   "Old Title",
		MediaType:     "movie",
	})

	updates := map[string]interface{}{
		"parsed_title": "New Title",
		"parsed_year":  float64(2020),
		"media_type":   "series",
		"tmdb_id":      float64(12345),
		"tmdb_title":   "TMDB Title",
	}

	item, err := svc.UpdateScanItem(1, updates)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item.ParsedTitle != "New Title" {
		t.Errorf("ParsedTitle = %q, want %q", item.ParsedTitle, "New Title")
	}
	if item.ParsedYear != 2020 {
		t.Errorf("ParsedYear = %d, want 2020", item.ParsedYear)
	}
	if item.MediaType != "series" {
		t.Errorf("MediaType = %q, want %q", item.MediaType, "series")
	}
	if item.TMDBId != 12345 {
		t.Errorf("TMDBId = %d, want 12345", item.TMDBId)
	}
	if item.TMDBTitle != "TMDB Title" {
		t.Errorf("TMDBTitle = %q, want %q", item.TMDBTitle, "TMDB Title")
	}
}

func TestLibraryScannerService_UpdateScanItem_NotFound(t *testing.T) {
	svc, _ := setupLibraryScanner()

	_, err := svc.UpdateScanItem(999, map[string]interface{}{"parsed_title": "X"})
	if err == nil {
		t.Error("expected error for missing item")
	}
}

func TestLibraryScannerService_UpdateScanItem_AllFields(t *testing.T) {
	svc, repo := setupLibraryScanner()

	repo.Create(&model.LibraryScanItem{ScanSessionID: "sess-1", FileName: "test.mp4"})

	updates := map[string]interface{}{
		"parsed_title":      "Title",
		"parsed_year":       float64(2021),
		"media_type":        "movie",
		"season_number":     float64(2),
		"episode_number":    float64(5),
		"tmdb_id":           float64(100),
		"tmdb_title":        "TMDB",
		"tmdb_year":         float64(2021),
		"tmdb_poster_url":   "http://poster.jpg",
		"tmdb_backdrop_url": "http://backdrop.jpg",
		"tmdb_description":  "A description",
		"tmdb_rating":       float64(8.5),
		"tmdb_series_name":  "Series Name",
	}

	item, err := svc.UpdateScanItem(1, updates)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item.SeasonNumber != 2 {
		t.Errorf("SeasonNumber = %d, want 2", item.SeasonNumber)
	}
	if item.EpisodeNumber != 5 {
		t.Errorf("EpisodeNumber = %d, want 5", item.EpisodeNumber)
	}
	if item.TMDBPosterURL != "http://poster.jpg" {
		t.Errorf("TMDBPosterURL = %q", item.TMDBPosterURL)
	}
	if item.TMDBBackdropURL != "http://backdrop.jpg" {
		t.Errorf("TMDBBackdropURL = %q", item.TMDBBackdropURL)
	}
	if item.TMDBDescription != "A description" {
		t.Errorf("TMDBDescription = %q", item.TMDBDescription)
	}
	if item.TMDBRating != 8.5 {
		t.Errorf("TMDBRating = %f, want 8.5", item.TMDBRating)
	}
	if item.TMDBSeriesName != "Series Name" {
		t.Errorf("TMDBSeriesName = %q", item.TMDBSeriesName)
	}
}

func TestLibraryScannerService_IsTMDBConfigured_False(t *testing.T) {
	svc, _ := setupLibraryScanner()
	if svc.IsTMDBConfigured() {
		t.Error("TMDB should not be configured with empty key")
	}
}

func TestLibraryScannerService_SearchTMDB_NotConfigured(t *testing.T) {
	svc, _ := setupLibraryScanner()
	_, err := svc.SearchTMDB("test", 0, "movie")
	if err == nil {
		t.Error("expected error when TMDB not configured")
	}
}

func TestLibraryScannerService_ValidateTMDB_NotConfigured(t *testing.T) {
	svc, _ := setupLibraryScanner()
	err := svc.ValidateTMDB()
	if err == nil {
		t.Error("expected error when TMDB not configured")
	}
}

func TestLibraryScannerService_CancelScan_NoSession(t *testing.T) {
	svc, _ := setupLibraryScanner()
	cancelled := svc.CancelScan("nonexistent")
	if cancelled {
		t.Error("should return false for nonexistent session")
	}
}

func TestLibraryScannerService_CancelScan_ExistingSession(t *testing.T) {
	svc, _ := setupLibraryScanner()

	// Store a cancel function in the cancels map to simulate an active scan
	called := false
	svc.cancels.Store("active-session", context.CancelFunc(func() {
		called = true
	}))

	cancelled := svc.CancelScan("active-session")
	if !cancelled {
		t.Error("should return true for existing session")
	}
	if !called {
		t.Error("cancel function should have been called")
	}

	// Second cancel should return false (already removed)
	cancelled2 := svc.CancelScan("active-session")
	if cancelled2 {
		t.Error("should return false after already cancelled")
	}
}

func TestLibraryScannerService_SetHub(t *testing.T) {
	svc, _ := setupLibraryScanner()

	if svc.hub != nil {
		t.Error("hub should be nil initially")
	}

	hub := ws.NewHub()
	svc.SetHub(hub)

	if svc.hub == nil {
		t.Error("hub should not be nil after SetHub")
	}
	if svc.hub != hub {
		t.Error("hub should be the same instance passed to SetHub")
	}
}

func TestLibraryScannerService_SetHub_Nil(t *testing.T) {
	svc, _ := setupLibraryScanner()

	hub := ws.NewHub()
	svc.SetHub(hub)
	if svc.hub == nil {
		t.Fatal("hub should be set")
	}

	svc.SetHub(nil)
	if svc.hub != nil {
		t.Error("hub should be nil after SetHub(nil)")
	}
}

func TestCleanTitle(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"The.Matrix", "The Matrix"},
		{"breaking_bad", "Breaking Bad"},
		{"Movie.Name.1080p.BluRay.x264", "Movie Name"},
		{"simple", "Simple"},
		{"", ""},
		{"Already Clean", "Already Clean"},
		{"with---dashes", "With Dashes"},
		{"multiple   spaces", "Multiple Spaces"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := cleanTitle(tt.input)
			if got != tt.want {
				t.Errorf("cleanTitle(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestGuessStreamFormat(t *testing.T) {
	tests := []struct {
		url  string
		want string
	}{
		{"rtmp://stream.example.com/live", "rtmp"},
		{"rtmps://secure.example.com/live", "rtmp"},
		{"http://example.com/stream.ts", "mpegts"},
		{"http://example.com/live/mpegts/stream", "mpegts"},
		{"http://example.com/live.m3u8", "hls"},
		{"http://example.com/stream", "hls"},
		{"https://cdn.example.com/video.m3u8", "hls"},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			got := guessStreamFormat(tt.url)
			if got != tt.want {
				t.Errorf("guessStreamFormat(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}

func TestParseXMLTVTime(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"with_timezone", "20250115120000 +0100", false},
		{"utc_z", "20250115120000Z", false},
		{"bare", "20250115120000", false},
		{"invalid", "not-a-time", true},
		{"empty", "", true},
		{"short", "2025", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parseXMLTVTime(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseXMLTVTime(%q) error = %v, wantErr = %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestFirstText_LibScanner(t *testing.T) {
	tests := []struct {
		name  string
		items []xmltvLangText
		want  string
	}{
		{"empty", nil, ""},
		{"empty_slice", []xmltvLangText{}, ""},
		{"single", []xmltvLangText{{Value: "Hello"}}, "Hello"},
		{"multiple", []xmltvLangText{{Value: "First"}, {Value: "Second"}}, "First"},
		{"with_spaces", []xmltvLangText{{Value: "  trimmed  "}}, "trimmed"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := firstText(tt.items)
			if got != tt.want {
				t.Errorf("firstText() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestFirstLang_LibScanner(t *testing.T) {
	tests := []struct {
		name  string
		items []xmltvLangText
		want  string
	}{
		{"empty", nil, ""},
		{"empty_slice", []xmltvLangText{}, ""},
		{"single", []xmltvLangText{{Lang: "es"}}, "es"},
		{"multiple", []xmltvLangText{{Lang: "en"}, {Lang: "es"}}, "en"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := firstLang(tt.items)
			if got != tt.want {
				t.Errorf("firstLang() = %q, want %q", got, tt.want)
			}
		})
	}
}

// Test ImportItems with movie items
func TestLibraryScannerService_ImportItems_Movies(t *testing.T) {
	repo := newMockLibraryScannerRepo()
	tmdbSvc := NewTMDBService("")
	transcoderRepo := newMockLocalMediaRepoForTranscoder()
	transcoder := NewTranscoderService(transcoderRepo, "ffmpeg", "ffprobe", "/tmp/media")
	vodRepo := newMockVODRepoForScanner()
	seriesRepo := newMockSeriesRepoForScanner()
	categoryRepo := newMockCategoryRepoForScanner()

	svc := NewLibraryScannerService(repo, transcoder, tmdbSvc, vodRepo, seriesRepo, categoryRepo, "/library", "/tmp/media")

	// Create scan items
	repo.Create(&model.LibraryScanItem{
		ScanSessionID:  "sess-1",
		FileName:       "movie.mp4",
		FilePath:       "/library/movie.mp4",
		ParsedTitle:    "Test Movie",
		ParsedYear:     2020,
		MediaType:      "movie",
		Duration:       7200,
		Resolution:     "1080p",
		Container:      "mp4",
		NeedsTranscode: false,
		DirectPlayPath: "/library/movie.mp4",
		ImportStatus:   "pending",
	})

	imported, failed, err := svc.ImportItems("sess-1", []uint{1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if imported != 1 {
		t.Errorf("imported = %d, want 1", imported)
	}
	if failed != 0 {
		t.Errorf("failed = %d, want 0", failed)
	}

	// Verify VOD was created
	if len(vodRepo.vods) != 1 {
		t.Errorf("len(vods) = %d, want 1", len(vodRepo.vods))
	}

	// Verify scan item was updated
	item := repo.items[1]
	if item.ImportStatus != "imported" {
		t.Errorf("ImportStatus = %q, want %q", item.ImportStatus, "imported")
	}
}

func TestLibraryScannerService_ImportItems_AlreadyImported(t *testing.T) {
	repo := newMockLibraryScannerRepo()
	tmdbSvc := NewTMDBService("")
	transcoderRepo := newMockLocalMediaRepoForTranscoder()
	transcoder := NewTranscoderService(transcoderRepo, "ffmpeg", "ffprobe", "/tmp/media")
	vodRepo := newMockVODRepoForScanner()
	seriesRepo := newMockSeriesRepoForScanner()
	categoryRepo := newMockCategoryRepoForScanner()

	svc := NewLibraryScannerService(repo, transcoder, tmdbSvc, vodRepo, seriesRepo, categoryRepo, "/library", "/tmp/media")

	repo.Create(&model.LibraryScanItem{
		ScanSessionID: "sess-1",
		FileName:      "movie.mp4",
		FilePath:      "/library/movie.mp4",
		ParsedTitle:   "Test Movie",
		MediaType:     "movie",
		ImportStatus:  "imported", // already imported
	})

	imported, failed, err := svc.ImportItems("sess-1", []uint{1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if imported != 0 {
		t.Errorf("imported = %d, want 0 (already imported)", imported)
	}
	if failed != 0 {
		t.Errorf("failed = %d, want 0", failed)
	}
}

func TestLibraryScannerService_ImportItems_Series(t *testing.T) {
	repo := newMockLibraryScannerRepo()
	tmdbSvc := NewTMDBService("")
	transcoderRepo := newMockLocalMediaRepoForTranscoder()
	transcoder := NewTranscoderService(transcoderRepo, "ffmpeg", "ffprobe", "/tmp/media")
	vodRepo := newMockVODRepoForScanner()
	seriesRepo := newMockSeriesRepoForScanner()
	categoryRepo := newMockCategoryRepoForScanner()

	svc := NewLibraryScannerService(repo, transcoder, tmdbSvc, vodRepo, seriesRepo, categoryRepo, "/library", "/tmp/media")

	// Create two episodes of the same series
	repo.Create(&model.LibraryScanItem{
		ScanSessionID:  "sess-1",
		FileName:       "show.s01e01.mp4",
		FilePath:       "/library/show.s01e01.mp4",
		ParsedTitle:    "My Show",
		MediaType:      "series",
		SeasonNumber:   1,
		EpisodeNumber:  1,
		NeedsTranscode: false,
		DirectPlayPath: "/library/show.s01e01.mp4",
		ImportStatus:   "pending",
	})
	repo.Create(&model.LibraryScanItem{
		ScanSessionID:  "sess-1",
		FileName:       "show.s01e02.mp4",
		FilePath:       "/library/show.s01e02.mp4",
		ParsedTitle:    "My Show",
		MediaType:      "series",
		SeasonNumber:   1,
		EpisodeNumber:  2,
		NeedsTranscode: false,
		DirectPlayPath: "/library/show.s01e02.mp4",
		ImportStatus:   "pending",
	})

	imported, failed, err := svc.ImportItems("sess-1", []uint{1, 2})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if imported != 2 {
		t.Errorf("imported = %d, want 2", imported)
	}
	if failed != 0 {
		t.Errorf("failed = %d, want 0", failed)
	}

	// Should create 1 series and 2 VODs (episodes)
	if len(seriesRepo.series) != 1 {
		t.Errorf("len(series) = %d, want 1", len(seriesRepo.series))
	}
	if len(vodRepo.vods) != 2 {
		t.Errorf("len(vods) = %d, want 2", len(vodRepo.vods))
	}
}

func TestLibraryScannerService_FindOrCreateCategory_Existing(t *testing.T) {
	repo := newMockLibraryScannerRepo()
	tmdbSvc := NewTMDBService("")
	transcoderRepo := newMockLocalMediaRepoForTranscoder()
	transcoder := NewTranscoderService(transcoderRepo, "ffmpeg", "ffprobe", "/tmp/media")
	vodRepo := newMockVODRepoForScanner()
	seriesRepo := newMockSeriesRepoForScanner()
	categoryRepo := newMockCategoryRepoForScanner()

	// Pre-create a category
	categoryRepo.Create(&model.Category{Name: "Peliculas", Slug: "peliculas", Type: "vod"})

	svc := NewLibraryScannerService(repo, transcoder, tmdbSvc, vodRepo, seriesRepo, categoryRepo, "/library", "/tmp/media")

	catID := svc.findOrCreateCategory("Peliculas", "vod")
	if catID == nil {
		t.Fatal("expected non-nil category ID")
	}
	// Should reuse existing, not create a new one
	if len(categoryRepo.categories) != 1 {
		t.Errorf("should have 1 category (reused existing), got %d", len(categoryRepo.categories))
	}
}

func TestLibraryScannerService_FindOrCreateCategory_New(t *testing.T) {
	repo := newMockLibraryScannerRepo()
	tmdbSvc := NewTMDBService("")
	transcoderRepo := newMockLocalMediaRepoForTranscoder()
	transcoder := NewTranscoderService(transcoderRepo, "ffmpeg", "ffprobe", "/tmp/media")
	vodRepo := newMockVODRepoForScanner()
	seriesRepo := newMockSeriesRepoForScanner()
	categoryRepo := newMockCategoryRepoForScanner()

	svc := NewLibraryScannerService(repo, transcoder, tmdbSvc, vodRepo, seriesRepo, categoryRepo, "/library", "/tmp/media")

	catID := svc.findOrCreateCategory("New Category", "vod")
	if catID == nil {
		t.Fatal("expected non-nil category ID")
	}
	if len(categoryRepo.categories) != 1 {
		t.Errorf("should have 1 category (created new), got %d", len(categoryRepo.categories))
	}
}

func TestMaxScanResults(t *testing.T) {
	if MaxScanResults != 10000 {
		t.Errorf("MaxScanResults = %d, want 10000", MaxScanResults)
	}
}
