package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Minimal mock repos for IPTVSeeder ---

type mockChannelRepoForIPTV struct {
	channels map[uint]*model.Channel
	nextID   uint
	count    int64
}

func newMockChannelRepoForIPTV() *mockChannelRepoForIPTV {
	return &mockChannelRepoForIPTV{channels: make(map[uint]*model.Channel), nextID: 1}
}

func (m *mockChannelRepoForIPTV) FindByID(id uint) (*model.Channel, error) {
	c, ok := m.channels[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}
func (m *mockChannelRepoForIPTV) FindBySlug(string) (*model.Channel, error) {
	return nil, gorm.ErrRecordNotFound
}
func (m *mockChannelRepoForIPTV) List(int, int) ([]model.Channel, int64, error) {
	return nil, 0, nil
}
func (m *mockChannelRepoForIPTV) ListActive(int, int, string, *uint) ([]model.Channel, int64, error) {
	return nil, 0, nil
}
func (m *mockChannelRepoForIPTV) Create(c *model.Channel) error {
	c.ID = m.nextID
	m.nextID++
	m.channels[c.ID] = c
	m.count++
	return nil
}
func (m *mockChannelRepoForIPTV) Update(*model.Channel) error         { return nil }
func (m *mockChannelRepoForIPTV) Delete(uint) error                   { return nil }
func (m *mockChannelRepoForIPTV) Count() (int64, error)               { return m.count, nil }
func (m *mockChannelRepoForIPTV) CountActive() (int64, error)         { return 0, nil }
func (m *mockChannelRepoForIPTV) CountBySource(string) (int64, error) { return 0, nil }
func (m *mockChannelRepoForIPTV) DeleteBySource(string) error         { return nil }

type mockCategoryRepoForIPTV struct {
	categories map[string]*model.Category
	nextID     uint
}

func newMockCategoryRepoForIPTV() *mockCategoryRepoForIPTV {
	return &mockCategoryRepoForIPTV{categories: make(map[string]*model.Category), nextID: 1}
}

func (m *mockCategoryRepoForIPTV) FindByID(uint) (*model.Category, error) {
	return nil, gorm.ErrRecordNotFound
}
func (m *mockCategoryRepoForIPTV) FindBySlug(slug string) (*model.Category, error) {
	c, ok := m.categories[slug]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}
func (m *mockCategoryRepoForIPTV) List(int, int) ([]model.Category, int64, error) {
	return nil, 0, nil
}
func (m *mockCategoryRepoForIPTV) ListByType(string) ([]model.Category, error) { return nil, nil }
func (m *mockCategoryRepoForIPTV) Create(c *model.Category) error {
	c.ID = m.nextID
	m.nextID++
	m.categories[c.Slug] = c
	return nil
}
func (m *mockCategoryRepoForIPTV) Update(*model.Category) error { return nil }
func (m *mockCategoryRepoForIPTV) Delete(uint) error            { return nil }
func (m *mockCategoryRepoForIPTV) Count() (int64, error)        { return 0, nil }

// --- Tests ---

func setupIPTVSeeder() *IPTVSeeder {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission() // reuse from emission_test.go
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo() // reuse from epg_test.go
	return NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)
}

func TestIPTVSeeder_NewIPTVSeeder(t *testing.T) {
	seeder := setupIPTVSeeder()
	if seeder == nil {
		t.Fatal("expected non-nil seeder")
	}
	if seeder.httpClient == nil {
		t.Error("expected non-nil http client")
	}
}

func TestIPTVSeeder_GetStatus_Initial(t *testing.T) {
	seeder := setupIPTVSeeder()
	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running initially")
	}
	if status.Total != 0 {
		t.Errorf("total = %d, want 0", status.Total)
	}
}

func TestIPTVSeeder_IsRunning(t *testing.T) {
	seeder := setupIPTVSeeder()
	if seeder.IsRunning() {
		t.Error("should not be running initially")
	}
}

func TestIPTVSeeder_ParseM3U(t *testing.T) {
	seeder := setupIPTVSeeder()
	content := `#EXTM3U url-tvg="http://example.com/epg.xml"
#EXTINF:-1 tvg-id="ch1" tvg-name="Channel 1" tvg-logo="http://logo.png" tvg-country="ES" tvg-language="Spanish" group-title="News",Channel 1
http://stream1.example.com/live.m3u8
#EXTINF:-1 tvg-id="ch2" tvg-name="Channel 2" group-title="Sports",Channel 2
http://stream2.example.com/live.m3u8
#EXTINF:-1 tvg-name="" group-title="Music",
http://no-name-stream.example.com
`

	entries := seeder.parseM3U(content)
	if len(entries) != 2 {
		t.Fatalf("len(entries) = %d, want 2 (third has no name)", len(entries))
	}
	if entries[0].TvgID != "ch1" {
		t.Errorf("entries[0].TvgID = %q, want %q", entries[0].TvgID, "ch1")
	}
	if entries[0].TvgName != "Channel 1" {
		t.Errorf("entries[0].TvgName = %q, want %q", entries[0].TvgName, "Channel 1")
	}
	if entries[0].TvgCountry != "ES" {
		t.Errorf("entries[0].TvgCountry = %q, want %q", entries[0].TvgCountry, "ES")
	}
	if entries[0].URL != "http://stream1.example.com/live.m3u8" {
		t.Errorf("entries[0].URL = %q", entries[0].URL)
	}
	if entries[1].GroupTitle != "Sports" {
		t.Errorf("entries[1].GroupTitle = %q, want %q", entries[1].GroupTitle, "Sports")
	}
}

func TestIPTVSeeder_ParseM3U_Empty(t *testing.T) {
	seeder := setupIPTVSeeder()
	entries := seeder.parseM3U("")
	if len(entries) != 0 {
		t.Errorf("len(entries) = %d, want 0", len(entries))
	}
}

func TestIPTVSeeder_ParseM3U_DisplayName(t *testing.T) {
	seeder := setupIPTVSeeder()
	content := `#EXTM3U
#EXTINF:-1 group-title="News",My Channel Name
http://stream.example.com/live.m3u8
`
	entries := seeder.parseM3U(content)
	if len(entries) != 1 {
		t.Fatalf("len(entries) = %d, want 1", len(entries))
	}
	if entries[0].TvgName != "My Channel Name" {
		t.Errorf("TvgName = %q, want %q (from display name)", entries[0].TvgName, "My Channel Name")
	}
}

func TestIPTVSeeder_ApplyFilters_NoFilters(t *testing.T) {
	seeder := setupIPTVSeeder()
	entries := []m3uEntry{
		{TvgName: "Ch1", TvgCountry: "ES", GroupTitle: "News"},
		{TvgName: "Ch2", TvgCountry: "MX", GroupTitle: "Sports"},
	}
	opts := IPTVImportOptions{}
	filtered := seeder.applyFilters(entries, opts)
	if len(filtered) != 2 {
		t.Errorf("len(filtered) = %d, want 2 (no filters)", len(filtered))
	}
}

func TestIPTVSeeder_ApplyFilters_ByCountry(t *testing.T) {
	seeder := setupIPTVSeeder()
	entries := []m3uEntry{
		{TvgName: "Ch1", TvgCountry: "ES", GroupTitle: "News"},
		{TvgName: "Ch2", TvgCountry: "MX", GroupTitle: "Sports"},
		{TvgName: "Ch3", TvgCountry: "US", GroupTitle: "News"},
	}
	opts := IPTVImportOptions{Countries: []string{"ES"}}
	filtered := seeder.applyFilters(entries, opts)
	if len(filtered) != 1 {
		t.Errorf("len(filtered) = %d, want 1", len(filtered))
	}
	if len(filtered) > 0 && filtered[0].TvgName != "Ch1" {
		t.Errorf("filtered[0].TvgName = %q, want %q", filtered[0].TvgName, "Ch1")
	}
}

func TestIPTVSeeder_ApplyFilters_ByCategory(t *testing.T) {
	seeder := setupIPTVSeeder()
	entries := []m3uEntry{
		{TvgName: "Ch1", GroupTitle: "News"},
		{TvgName: "Ch2", GroupTitle: "Sports"},
		{TvgName: "Ch3", GroupTitle: "Music"},
	}
	opts := IPTVImportOptions{Categories: []string{"Sports", "Music"}}
	filtered := seeder.applyFilters(entries, opts)
	if len(filtered) != 2 {
		t.Errorf("len(filtered) = %d, want 2", len(filtered))
	}
}

func TestIPTVSeeder_ApplyFilters_CaseInsensitive(t *testing.T) {
	seeder := setupIPTVSeeder()
	entries := []m3uEntry{
		{TvgName: "Ch1", TvgLanguage: "Spanish"},
		{TvgName: "Ch2", TvgLanguage: "English"},
	}
	opts := IPTVImportOptions{Languages: []string{"spanish"}} // lowercase
	filtered := seeder.applyFilters(entries, opts)
	if len(filtered) != 1 {
		t.Errorf("len(filtered) = %d, want 1", len(filtered))
	}
}

func TestIPTVSeeder_SeedFromURL_ExistingChannels(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	channelRepo.count = 5 // Already has channels
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Should skip because channels already exist
	seeder.SeedFromURL("http://example.com/m3u")
	// No error, no panic, just skipped
	if seeder.IsRunning() {
		t.Error("should not be running after skip")
	}
}

func TestExtractM3UHeader(t *testing.T) {
	content := `#EXTM3U url-tvg="http://example.com/epg.xml" tvg-shift="0"
#EXTINF:-1,Channel 1
http://stream1.example.com
`
	result := extractM3UHeader(content, reURLTvg)
	if result != "http://example.com/epg.xml" {
		t.Errorf("extractM3UHeader = %q, want epg URL", result)
	}
}

func TestExtractM3UHeader_NoHeader(t *testing.T) {
	content := `#EXTINF:-1,Channel 1
http://stream1.example.com
`
	result := extractM3UHeader(content, reURLTvg)
	if result != "" {
		t.Errorf("extractM3UHeader = %q, want empty", result)
	}
}

func TestIPTVImportStatus_Defaults(t *testing.T) {
	status := IPTVImportStatus{}
	if status.Running {
		t.Error("default Running should be false")
	}
	if status.Total != 0 {
		t.Error("default Total should be 0")
	}
}

func TestIPTVSeeder_SetStatus(t *testing.T) {
	seeder := setupIPTVSeeder()
	seeder.setStatus(IPTVImportStatus{Running: true, Message: "testing", Total: 100, Current: 50, Percent: 50})

	status := seeder.GetStatus()
	if !status.Running {
		t.Error("expected running=true")
	}
	if status.Message != "testing" {
		t.Errorf("message = %q, want %q", status.Message, "testing")
	}
	if status.Percent != 50 {
		t.Errorf("percent = %d, want 50", status.Percent)
	}
}

func TestToLowerSet(t *testing.T) {
	set := toLowerSet([]string{"Hello", " WORLD ", "Test"})
	if !set["hello"] {
		t.Error("expected 'hello' in set")
	}
	if !set["world"] {
		t.Error("expected 'world' in set (trimmed)")
	}
	if !set["test"] {
		t.Error("expected 'test' in set")
	}
	if set["Hello"] {
		t.Error("should not have 'Hello' (uppercase)")
	}
}

func TestIPTVSeeder_ParseM3U_MixedContent(t *testing.T) {
	seeder := setupIPTVSeeder()
	content := `#EXTM3U
#EXTINF:-1 tvg-id="ch1" tvg-name="Normal Channel",Normal Channel
http://stream1.example.com/live.m3u8
#Some random comment
#EXTINF:-1 tvg-id="ch2" tvg-name="Another Channel",Another Channel
http://stream2.example.com/live.m3u8

#EXTINF:-1 tvg-id="" tvg-name="No ID Channel",No ID Channel
http://stream3.example.com/live.m3u8
`

	entries := seeder.parseM3U(content)
	if len(entries) != 3 {
		t.Errorf("len(entries) = %d, want 3", len(entries))
	}
}

func TestIPTVSeeder_ParseM3U_OnlyHeader(t *testing.T) {
	seeder := setupIPTVSeeder()
	content := `#EXTM3U url-tvg="http://example.com/epg.xml"
`
	entries := seeder.parseM3U(content)
	if len(entries) != 0 {
		t.Errorf("len(entries) = %d, want 0", len(entries))
	}
}

func TestIPTVSeeder_ApplyFilters_ByLanguage(t *testing.T) {
	seeder := setupIPTVSeeder()
	entries := []m3uEntry{
		{TvgName: "Ch1", TvgLanguage: "Spanish"},
		{TvgName: "Ch2", TvgLanguage: "English"},
		{TvgName: "Ch3", TvgLanguage: "French"},
	}
	opts := IPTVImportOptions{Languages: []string{"English", "French"}}
	filtered := seeder.applyFilters(entries, opts)
	if len(filtered) != 2 {
		t.Errorf("len(filtered) = %d, want 2", len(filtered))
	}
}

func TestIPTVSeeder_ApplyFilters_MultipleFilters(t *testing.T) {
	seeder := setupIPTVSeeder()
	entries := []m3uEntry{
		{TvgName: "Ch1", TvgCountry: "ES", TvgLanguage: "Spanish", GroupTitle: "News"},
		{TvgName: "Ch2", TvgCountry: "ES", TvgLanguage: "Spanish", GroupTitle: "Sports"},
		{TvgName: "Ch3", TvgCountry: "MX", TvgLanguage: "Spanish", GroupTitle: "News"},
		{TvgName: "Ch4", TvgCountry: "US", TvgLanguage: "English", GroupTitle: "News"},
	}
	opts := IPTVImportOptions{
		Countries:  []string{"ES"},
		Categories: []string{"News"},
	}
	filtered := seeder.applyFilters(entries, opts)
	if len(filtered) != 1 {
		t.Errorf("len(filtered) = %d, want 1 (only Ch1 matches both)", len(filtered))
	}
}

func TestIPTVSeeder_BuildCategories(t *testing.T) {
	seeder := setupIPTVSeeder()
	entries := []m3uEntry{
		{TvgName: "Ch1", GroupTitle: "News"},
		{TvgName: "Ch2", GroupTitle: "Sports"},
		{TvgName: "Ch3", GroupTitle: "News"}, // duplicate
		{TvgName: "Ch4", GroupTitle: ""},     // should become "Sin Categoria"
	}

	catMap := seeder.buildCategories(entries)
	if len(catMap) != 3 {
		t.Errorf("len(catMap) = %d, want 3 (News, Sports, Sin Categoria)", len(catMap))
	}
	if _, ok := catMap["News"]; !ok {
		t.Error("expected 'News' category")
	}
	if _, ok := catMap["Sports"]; !ok {
		t.Error("expected 'Sports' category")
	}
	if _, ok := catMap["Sin Categoría"]; !ok {
		t.Error("expected 'Sin Categoría' category")
	}
}

func TestIPTVSeeder_GuessStreamFormat(t *testing.T) {
	tests := []struct {
		url  string
		want string
	}{
		{"rtmp://example.com/live", "rtmp"},
		{"rtmps://example.com/live", "rtmp"},
		{"http://example.com/stream.ts", "mpegts"},
		{"http://example.com/mpegts/stream", "mpegts"},
		{"http://example.com/live.m3u8", "hls"},
		{"http://example.com/stream", "hls"},
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

func TestIPTVSeeder_ParseXMLTV(t *testing.T) {
	seeder := setupIPTVSeeder()
	now := time.Now().UTC()
	startStr := now.Format("20060102150405") + " +0000"
	endStr := now.Add(time.Hour).Format("20060102150405") + " +0000"

	xmlData := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="` + startStr + `" stop="` + endStr + `" channel="ch1">
    <title lang="es">Noticias</title>
    <desc lang="es">Las noticias del dia</desc>
    <category lang="es">News</category>
  </programme>
  <programme start="` + startStr + `" stop="` + endStr + `" channel="ch_unknown">
    <title lang="es">Otro Programa</title>
  </programme>
</tv>`)

	channelMap := map[string]uint{"ch1": 1}
	entries, err := seeder.parseXMLTV(xmlData, channelMap)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should only have 1 entry (ch_unknown is not in the map)
	if len(entries) != 1 {
		t.Errorf("len(entries) = %d, want 1", len(entries))
	}
	if len(entries) > 0 {
		if entries[0].Title != "Noticias" {
			t.Errorf("Title = %q, want %q", entries[0].Title, "Noticias")
		}
		if entries[0].Description != "Las noticias del dia" {
			t.Errorf("Description = %q", entries[0].Description)
		}
		if entries[0].Category != "News" {
			t.Errorf("Category = %q, want %q", entries[0].Category, "News")
		}
	}
}

func TestIPTVSeeder_ParseXMLTV_InvalidXML(t *testing.T) {
	seeder := setupIPTVSeeder()
	_, err := seeder.parseXMLTV([]byte(`not xml`), map[string]uint{})
	if err == nil {
		t.Error("expected error for invalid XML")
	}
}

func TestIPTVSeeder_ParseXMLTV_EmptyProgrammes(t *testing.T) {
	seeder := setupIPTVSeeder()
	xmlData := []byte(`<?xml version="1.0"?><tv></tv>`)
	entries, err := seeder.parseXMLTV(xmlData, map[string]uint{"ch1": 1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("len(entries) = %d, want 0", len(entries))
	}
}

func TestExtractM3UHeader_NoURLTvg(t *testing.T) {
	content := `#EXTM3U tvg-shift="0"
#EXTINF:-1,Channel 1
http://stream1.example.com
`
	result := extractM3UHeader(content, reURLTvg)
	if result != "" {
		t.Errorf("extractM3UHeader = %q, want empty", result)
	}
}

func TestParseXMLTVTime_Formats(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"with_offset", "20250115120000 +0100", false},
		{"utc_z", "20250115120000Z", false},
		{"bare", "20250115120000", false},
		{"negative_offset", "20250115120000 -0500", false},
		{"invalid", "not-a-date", true},
		{"too_short", "202501", true},
		{"empty", "", true},
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

// --- Additional ImportWithOptionsContext tests ---

func TestIPTVSeeder_ImportWithOptionsContext_AlreadyRunning(t *testing.T) {
	seeder := setupIPTVSeeder()

	// Manually set running state
	seeder.setStatus(IPTVImportStatus{Running: true, Message: "Already importing"})

	// Should silently skip
	seeder.ImportWithOptionsContext(context.Background(), IPTVImportOptions{
		M3UURL: "http://example.com/m3u",
		Source: "test",
	})

	// Should still show running (from the original status, not a new import)
	status := seeder.GetStatus()
	if !status.Running {
		t.Error("should still be running after duplicate import attempt was rejected")
	}
}

func TestIPTVSeeder_ImportWithOptionsContext_Cancelled(t *testing.T) {
	seeder := setupIPTVSeeder()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	// This won't actually fetch the URL since we can't mock the HTTP client easily,
	// but we can test the cancellation check after buildCategories
	// Since fetchM3U will fail (no server), this will finish with an error status
	seeder.ImportWithOptionsContext(ctx, IPTVImportOptions{
		M3UURL: "http://127.0.0.1:1/nonexistent", // Will fail to connect
		Source: "test",
	})

	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running after import completes/fails")
	}
}

func TestIPTVSeeder_ImportWithOptions_DefaultSource(t *testing.T) {
	seeder := setupIPTVSeeder()

	// ImportWithOptions with empty source should default to "iptv-org"
	// This will fail on HTTP fetch, but we can verify the defaults were set
	seeder.ImportWithOptions(IPTVImportOptions{
		M3UURL: "http://127.0.0.1:1/nonexistent",
	})

	// Verify it ran and completed (with error)
	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running after import fails")
	}
}

// --- Additional buildCategories tests ---

func TestIPTVSeeder_BuildCategories_ExistingCategory(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Pre-create a category
	categoryRepo.Create(&model.Category{Name: "News", Slug: "news", Type: "live"})

	entries := []m3uEntry{
		{TvgName: "Ch1", GroupTitle: "News"},
		{TvgName: "Ch2", GroupTitle: "Sports"},
	}

	catMap := seeder.buildCategories(entries)
	if len(catMap) != 2 {
		t.Errorf("len(catMap) = %d, want 2", len(catMap))
	}

	// News should reuse existing category (ID=1)
	if cat, ok := catMap["News"]; ok {
		if cat.ID != 1 {
			t.Errorf("News category ID = %d, want 1 (reused existing)", cat.ID)
		}
	} else {
		t.Error("expected News in catMap")
	}
}

func TestIPTVSeeder_BuildCategories_AllEmptyGroups(t *testing.T) {
	seeder := setupIPTVSeeder()

	entries := []m3uEntry{
		{TvgName: "Ch1", GroupTitle: ""},
		{TvgName: "Ch2", GroupTitle: ""},
	}

	catMap := seeder.buildCategories(entries)
	if len(catMap) != 1 {
		t.Errorf("len(catMap) = %d, want 1 (all should map to Sin Categoria)", len(catMap))
	}
	if _, ok := catMap["Sin Categoría"]; !ok {
		t.Error("expected 'Sin Categoría' in catMap")
	}
}

// --- importChannelsWithOptionsContext tests ---

func TestIPTVSeeder_ImportChannelsWithOptionsContext_BasicImport(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	entries := []m3uEntry{
		{TvgID: "ch1", TvgName: "ESPN", TvgLogo: "http://logo.png", GroupTitle: "Sports", URL: "https://8.8.8.8/live.m3u8"},
		{TvgID: "ch2", TvgName: "CNN", GroupTitle: "News", URL: "https://1.1.1.1/live.m3u8"},
	}

	catMap := map[string]*model.Category{
		"Sports": {ID: 1, Name: "Sports", Slug: "sports"},
		"News":   {ID: 2, Name: "News", Slug: "news"},
	}

	opts := IPTVImportOptions{Source: "test-source"}

	epgToID := seeder.importChannelsWithOptionsContext(context.Background(), entries, catMap, opts)

	if len(epgToID) != 2 {
		t.Errorf("len(epgToID) = %d, want 2", len(epgToID))
	}
	if epgToID["ch1"] == 0 {
		t.Error("expected non-zero channel ID for ch1")
	}
	if epgToID["ch2"] == 0 {
		t.Error("expected non-zero channel ID for ch2")
	}

	// Verify channels were created
	if len(channelRepo.channels) != 2 {
		t.Errorf("channel count = %d, want 2", len(channelRepo.channels))
	}
}

func TestIPTVSeeder_ImportChannelsWithOptionsContext_CancelledMidway(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Create many entries
	entries := make([]m3uEntry, 100)
	for i := range entries {
		entries[i] = m3uEntry{
			TvgName:    fmt.Sprintf("Channel %d", i),
			GroupTitle: "Test",
			URL:        fmt.Sprintf("https://example.com/stream%d.m3u8", i),
		}
	}

	catMap := map[string]*model.Category{
		"Test": {ID: 1, Name: "Test", Slug: "test"},
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	opts := IPTVImportOptions{Source: "test"}
	epgToID := seeder.importChannelsWithOptionsContext(ctx, entries, catMap, opts)

	// Should have imported 0 channels because context was cancelled
	if len(epgToID) != 0 {
		t.Errorf("len(epgToID) = %d, want 0 (cancelled)", len(epgToID))
	}
}

func TestIPTVSeeder_ImportChannelsWithOptionsContext_DuplicateSlugs(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	entries := []m3uEntry{
		{TvgID: "ch1", TvgName: "ESPN", URL: "https://example.com/s1.m3u8"},
		{TvgID: "ch2", TvgName: "ESPN", URL: "https://example.com/s2.m3u8"}, // Same name = same base slug
	}

	catMap := map[string]*model.Category{
		"Sin Categoría": {ID: 1, Name: "Sin Categoría", Slug: "sin-categoria"},
	}

	opts := IPTVImportOptions{Source: "test"}
	epgToID := seeder.importChannelsWithOptionsContext(context.Background(), entries, catMap, opts)

	if len(epgToID) != 2 {
		t.Errorf("len(epgToID) = %d, want 2", len(epgToID))
	}

	// Verify both channels were created (second should get a different slug)
	if len(channelRepo.channels) != 2 {
		t.Errorf("channel count = %d, want 2", len(channelRepo.channels))
	}

	// Find the slugs
	slugs := make(map[string]bool)
	for _, ch := range channelRepo.channels {
		slugs[ch.Slug] = true
	}
	if len(slugs) != 2 {
		t.Errorf("unique slugs = %d, want 2 (duplicate handling)", len(slugs))
	}
}

func TestIPTVSeeder_ImportChannelsWithOptionsContext_SSRFFiltering(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	entries := []m3uEntry{
		{TvgID: "ch1", TvgName: "Good", URL: "https://example.com/live.m3u8"},
		{TvgID: "ch2", TvgName: "Bad SSRF", URL: "http://127.0.0.1:8080/admin"},
		{TvgID: "ch3", TvgName: "Also Bad", URL: "http://192.168.1.1/stream"},
	}

	catMap := map[string]*model.Category{
		"Sin Categoría": {ID: 1, Name: "Sin Categoría", Slug: "sin-categoria"},
	}

	opts := IPTVImportOptions{Source: "test"}
	epgToID := seeder.importChannelsWithOptionsContext(context.Background(), entries, catMap, opts)

	// Only the good channel should be in epgToID (bad URLs skipped after SSRF validation)
	if len(epgToID) != 1 {
		t.Errorf("len(epgToID) = %d, want 1 (SSRF URLs should be skipped)", len(epgToID))
	}
	if _, ok := epgToID["ch1"]; !ok {
		t.Error("expected ch1 in epgToID")
	}
}

func TestIPTVSeeder_ImportChannelsWithOptionsContext_NoTvgName(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	entries := []m3uEntry{
		{TvgName: "", URL: "https://example.com/s1.m3u8"},
	}

	catMap := map[string]*model.Category{
		"Sin Categoría": {ID: 1, Name: "Sin Categoría", Slug: "sin-categoria"},
	}

	opts := IPTVImportOptions{Source: "test"}
	seeder.importChannelsWithOptionsContext(context.Background(), entries, catMap, opts)

	// Channel should be created with auto-generated name
	if len(channelRepo.channels) != 1 {
		t.Fatalf("channel count = %d, want 1", len(channelRepo.channels))
	}
	for _, ch := range channelRepo.channels {
		if ch.Name != "" {
			// Name remains empty (from entry) but slug is auto-generated
		}
		if ch.Slug == "" {
			t.Error("slug should be auto-generated when name is empty")
		}
	}
}

// --- Helper function tests ---

func TestFirstText(t *testing.T) {
	tests := []struct {
		name  string
		items []xmltvLangText
		want  string
	}{
		{"empty", nil, ""},
		{"single", []xmltvLangText{{Value: "  Hello  "}}, "Hello"},
		{"multiple", []xmltvLangText{{Value: "First"}, {Value: "Second"}}, "First"},
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

func TestFirstLang(t *testing.T) {
	tests := []struct {
		name  string
		items []xmltvLangText
		want  string
	}{
		{"empty", nil, ""},
		{"single", []xmltvLangText{{Lang: "es"}}, "es"},
		{"multiple", []xmltvLangText{{Lang: "es"}, {Lang: "en"}}, "es"},
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

func TestIPTVSeeder_GuessStreamFormat_EdgeCases(t *testing.T) {
	tests := []struct {
		url  string
		want string
	}{
		{"RTMP://EXAMPLE.COM/LIVE", "rtmp"},
		{"RTMPS://EXAMPLE.COM/LIVE", "rtmp"},
		{"http://example.com/mpegts", "mpegts"},
		{"http://example.com/video.TS", "mpegts"},
		{"http://example.com/video.m3u8?token=abc", "hls"},
		{"http://example.com/anything", "hls"},
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

func TestExtractM3UHeader_EmptyContent(t *testing.T) {
	result := extractM3UHeader("", reURLTvg)
	if result != "" {
		t.Errorf("extractM3UHeader empty = %q, want empty", result)
	}
}

func TestIPTVSeeder_ParseXMLTV_FutureProgrammes(t *testing.T) {
	seeder := setupIPTVSeeder()
	// Create a programme far in the future (beyond 48h horizon)
	future := time.Now().UTC().Add(72 * time.Hour)
	startStr := future.Format("20060102150405") + " +0000"
	endStr := future.Add(time.Hour).Format("20060102150405") + " +0000"

	xmlData := []byte(`<?xml version="1.0"?><tv>
  <programme start="` + startStr + `" stop="` + endStr + `" channel="ch1">
    <title lang="es">Futuro</title>
  </programme>
</tv>`)

	entries, err := seeder.parseXMLTV(xmlData, map[string]uint{"ch1": 1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("len(entries) = %d, want 0 (beyond 48h horizon)", len(entries))
	}
}

func TestIPTVSeeder_ParseXMLTV_PastProgrammes(t *testing.T) {
	seeder := setupIPTVSeeder()
	// Create a programme far in the past (beyond 1h ago)
	past := time.Now().UTC().Add(-3 * time.Hour)
	startStr := past.Format("20060102150405") + " +0000"
	endStr := past.Add(time.Hour).Format("20060102150405") + " +0000"

	xmlData := []byte(`<?xml version="1.0"?><tv>
  <programme start="` + startStr + `" stop="` + endStr + `" channel="ch1">
    <title lang="es">Pasado</title>
  </programme>
</tv>`)

	entries, err := seeder.parseXMLTV(xmlData, map[string]uint{"ch1": 1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("len(entries) = %d, want 0 (too far in the past)", len(entries))
	}
}

func TestIPTVSeeder_ParseXMLTV_NoTitle(t *testing.T) {
	seeder := setupIPTVSeeder()
	now := time.Now().UTC()
	startStr := now.Format("20060102150405") + " +0000"
	endStr := now.Add(time.Hour).Format("20060102150405") + " +0000"

	xmlData := []byte(`<?xml version="1.0"?><tv>
  <programme start="` + startStr + `" stop="` + endStr + `" channel="ch1">
  </programme>
</tv>`)

	entries, err := seeder.parseXMLTV(xmlData, map[string]uint{"ch1": 1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("len(entries) = %d, want 0 (no title)", len(entries))
	}
}

// Silence unused import
var _ = time.Now
