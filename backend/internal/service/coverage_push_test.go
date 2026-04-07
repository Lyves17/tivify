package service

import (
	"compress/gzip"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/testutil"
	"github.com/tivify/backend/internal/ws"
)

// ============================================================================
// Channel.Create — sqlmock-backed tests to cover the Transaction path
// ============================================================================

func TestChannelService_Create_SuccessNoStreams(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	// Expect: BEGIN, INSERT channel, COMMIT
	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	// After create, GetByID looks up via repo — add the channel
	chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true})

	resp, err := svc.Create(dto.CreateChannelRequest{
		Name: "ESPN",
		Slug: "espn",
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp == nil {
		t.Fatal("Create() returned nil response")
	}
	if resp.Name != "ESPN" {
		t.Errorf("Create() name = %q, want %q", resp.Name, "ESPN")
	}
}

func TestChannelService_Create_WithValidStreams(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectQuery(`INSERT INTO "streams"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	chRepo.addChannel(&model.Channel{Name: "BBC", Slug: "bbc", IsActive: true})

	resp, err := svc.Create(dto.CreateChannelRequest{
		Name: "BBC",
		Streams: []dto.CreateStreamRequest{
			{URL: "https://example.com/live.m3u8", StreamFormat: "hls"},
		},
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp == nil {
		t.Fatal("Create() returned nil response")
	}
}

func TestChannelService_Create_WithMultipleStreams(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectQuery(`INSERT INTO "streams"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectQuery(`INSERT INTO "streams"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
	mock.ExpectCommit()

	chRepo.addChannel(&model.Channel{Name: "CNN", Slug: "cnn", IsActive: true})

	isActive := false
	resp, err := svc.Create(dto.CreateChannelRequest{
		Name: "CNN",
		Streams: []dto.CreateStreamRequest{
			{URL: "https://example.com/stream1.m3u8", StreamFormat: "hls", Priority: 1},
			{URL: "https://example.com/stream2.m3u8", StreamFormat: "hls", Priority: 2, IsActive: &isActive},
		},
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp == nil {
		t.Fatal("Create() returned nil response")
	}
}

func TestChannelService_Create_WithHeaders(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectQuery(`INSERT INTO "streams"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	chRepo.addChannel(&model.Channel{Name: "Fox", Slug: "fox", IsActive: true})

	resp, err := svc.Create(dto.CreateChannelRequest{
		Name: "Fox",
		Streams: []dto.CreateStreamRequest{
			{
				URL:          "https://example.com/stream.m3u8",
				StreamFormat: "hls",
				Headers:      `{"Referer": "https://example.com"}`,
			},
		},
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp == nil {
		t.Fatal("Create() returned nil response")
	}
}

func TestChannelService_Create_InvalidHeaders(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectRollback()

	_, err := svc.Create(dto.CreateChannelRequest{
		Name: "Test",
		Streams: []dto.CreateStreamRequest{
			{
				URL:     "https://example.com/stream.m3u8",
				Headers: "not-valid-json",
			},
		},
	})
	if err == nil {
		t.Fatal("Create() should return error for invalid headers JSON")
	}
}

func TestChannelService_Create_InvalidStreamURL(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectRollback()

	_, err := svc.Create(dto.CreateChannelRequest{
		Name: "Test",
		Streams: []dto.CreateStreamRequest{
			{URL: "not-a-url"},
		},
	})
	if err == nil {
		t.Fatal("Create() should return error for invalid stream URL")
	}
}

func TestChannelService_Create_TransactionError(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnError(sqlmock.ErrCancelled)
	mock.ExpectRollback()

	_, err := svc.Create(dto.CreateChannelRequest{
		Name: "Test",
	})
	if err == nil {
		t.Fatal("Create() should return error when transaction fails")
	}
}

func TestChannelService_Create_AutoSlugGeneration(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	chRepo.addChannel(&model.Channel{Name: "Test Channel", Slug: "test-channel", IsActive: true})

	resp, err := svc.Create(dto.CreateChannelRequest{
		Name: "Test Channel", // No slug provided — should auto-generate
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp == nil {
		t.Fatal("Create() returned nil response")
	}
}

func TestChannelService_Create_ExplicitIsActiveTrue(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	chRepo.addChannel(&model.Channel{Name: "Active", Slug: "active", IsActive: true})

	isActive := true
	resp, err := svc.Create(dto.CreateChannelRequest{
		Name:     "Active",
		IsActive: &isActive,
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp == nil {
		t.Fatal("Create() returned nil response")
	}
}

func TestChannelService_Create_ExplicitIsActiveFalse(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	chRepo.addChannel(&model.Channel{Name: "Inactive", Slug: "inactive", IsActive: false})

	isActive := false
	resp, err := svc.Create(dto.CreateChannelRequest{
		Name:     "Inactive",
		IsActive: &isActive,
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp == nil {
		t.Fatal("Create() returned nil response")
	}
}

func TestChannelService_Create_StreamCreateError(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectQuery(`INSERT INTO "streams"`).
		WillReturnError(sqlmock.ErrCancelled)
	mock.ExpectRollback()

	_, err := svc.Create(dto.CreateChannelRequest{
		Name: "Test",
		Streams: []dto.CreateStreamRequest{
			{URL: "https://example.com/stream.m3u8", StreamFormat: "hls"},
		},
	})
	if err == nil {
		t.Fatal("Create() should return error when stream insert fails")
	}
}

func TestChannelService_Create_HeadersTooLong(t *testing.T) {
	db, mock, cleanup := testutil.NewMockDB(t)
	defer cleanup()

	chRepo := newMockChannelRepo()
	sRepo := newMockStreamRepo()
	svc := NewChannelService(chRepo, sRepo, db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectRollback()

	// Generate headers > MaxHeadersLength
	longHeaders := `{"key": "` + string(make([]byte, 20000)) + `"}`

	_, err := svc.Create(dto.CreateChannelRequest{
		Name: "Test",
		Streams: []dto.CreateStreamRequest{
			{URL: "https://example.com/stream.m3u8", Headers: longHeaders},
		},
	})
	if err == nil {
		t.Fatal("Create() should return error for headers that exceed size limit")
	}
}

// ============================================================================
// Emission — broadcastStatus with hub
// ============================================================================

func TestEmissionService_BroadcastStatus_WithHub(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent")

	hub := ws.NewHub()
	go hub.Run()
	svc.SetHub(hub)

	// Should not panic when broadcasting with a hub
	svc.broadcastStatus(1, "running")
	svc.broadcastStatus(2, "stopped")
	svc.broadcastStatus(0, "error")
}

func TestEmissionService_BroadcastStatus_NilHub_Noop(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent")

	// Hub is nil by default — should not panic
	svc.broadcastStatus(1, "running")
}

// ============================================================================
// Emission — CleanupOnStartup with filesystem
// ============================================================================

func TestEmissionService_CleanupOnStartup_CleansLiveFiles(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()

	// Create temp directory structure for live files
	tmpDir := t.TempDir()
	liveDir := filepath.Join(tmpDir, "live", "1")
	os.MkdirAll(liveDir, 0755)

	// Create some fake live files
	os.WriteFile(filepath.Join(liveDir, "live.m3u8"), []byte("test"), 0644)
	os.WriteFile(filepath.Join(liveDir, "segment0.ts"), []byte("test"), 0644)
	os.WriteFile(filepath.Join(liveDir, "segment1.ts"), []byte("test"), 0644)

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", tmpDir)

	// No running emissions in DB
	svc.CleanupOnStartup()

	// Files should be cleaned up
	entries, err := os.ReadDir(liveDir)
	if err != nil {
		t.Fatalf("ReadDir error: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected 0 files after cleanup, got %d", len(entries))
	}
}

func TestEmissionService_CleanupOnStartup_MultipleChannelDirs(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()

	tmpDir := t.TempDir()

	// Create multiple channel live directories
	for _, ch := range []string{"1", "2", "10"} {
		dir := filepath.Join(tmpDir, "live", ch)
		os.MkdirAll(dir, 0755)
		os.WriteFile(filepath.Join(dir, "live.m3u8"), []byte("test"), 0644)
	}

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", tmpDir)
	svc.CleanupOnStartup()

	// All should be cleaned
	for _, ch := range []string{"1", "2", "10"} {
		dir := filepath.Join(tmpDir, "live", ch)
		entries, _ := os.ReadDir(dir)
		if len(entries) != 0 {
			t.Errorf("channel %s: expected 0 files, got %d", ch, len(entries))
		}
	}
}

func TestEmissionService_CleanupOnStartup_EmptyLiveDir(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()

	tmpDir := t.TempDir()

	// Create empty channel dir (no files inside)
	dir := filepath.Join(tmpDir, "live", "5")
	os.MkdirAll(dir, 0755)

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", tmpDir)
	svc.CleanupOnStartup()
	// No panic, no error
}

func TestEmissionService_CleanupOnStartup_WithRunningEmissions(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()

	tmpDir := t.TempDir()
	liveDir := filepath.Join(tmpDir, "live", "42")
	os.MkdirAll(liveDir, 0755)
	os.WriteFile(filepath.Join(liveDir, "live.m3u8"), []byte("test"), 0644)

	// Add a running emission with PID 0 (no real process to kill)
	emissionRepo.emissions[1] = &model.Emission{
		ChannelID: 42,
		Status:    "running",
		PID:       0,
	}
	emissionRepo.emissions[1].ID = 1

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", tmpDir)
	svc.CleanupOnStartup()

	// Emission should be reset to stopped
	e := emissionRepo.emissions[1]
	if e.Status != "stopped" {
		t.Errorf("emission status = %q, want %q", e.Status, "stopped")
	}
}

// ============================================================================
// Emission — cleanupLiveFiles
// ============================================================================

func TestEmissionService_CleanupLiveFiles_WithFiles(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()

	tmpDir := t.TempDir()
	liveDir := filepath.Join(tmpDir, "live", "7")
	os.MkdirAll(liveDir, 0755)
	os.WriteFile(filepath.Join(liveDir, "segment0.ts"), []byte("data"), 0644)
	os.WriteFile(filepath.Join(liveDir, "segment1.ts"), []byte("data"), 0644)
	os.WriteFile(filepath.Join(liveDir, "live.m3u8"), []byte("data"), 0644)

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", tmpDir)
	svc.cleanupLiveFiles(7)

	entries, _ := os.ReadDir(liveDir)
	if len(entries) != 0 {
		t.Errorf("expected 0 files after cleanup, got %d", len(entries))
	}
}

// ============================================================================
// Emission — Stop path (no process in map but updates DB)
// ============================================================================

func TestEmissionService_Stop_ClearsRetries(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", t.TempDir())

	// Pre-set retries for the channel
	svc.retries.Store(uint(5), 3)

	err := svc.Stop(5)
	if err != nil {
		t.Fatalf("Stop() error: %v", err)
	}

	// Retries should be cleared
	if _, loaded := svc.retries.Load(uint(5)); loaded {
		t.Error("retries should be deleted after Stop")
	}

	// Stopping flag should also be cleared (no process path)
	if _, loaded := svc.stopping.Load(uint(5)); loaded {
		t.Error("stopping flag should be cleared when no process")
	}
}

func TestEmissionService_Stop_DeactivatesLiveStream(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", t.TempDir())

	// Add a live stream — deactivateLiveStream will find and call Update on it
	streamRepo.Create(&model.Stream{
		ChannelID: 3,
		URL:       "/media/live/3/live.m3u8",
		IsActive:  true,
	})

	err := svc.Stop(3)
	if err != nil {
		t.Fatalf("Stop() error: %v", err)
	}
	// The deactivateLiveStream code path was exercised — Update mock is a no-op
	// but the code path (find live stream, call Update) was covered
}

// ============================================================================
// Emission — GetStatus edge cases
// ============================================================================

func TestEmissionService_GetStatus_RunningWithRealProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/test")

	// Create emission marked as running
	emissionRepo.emissions[1] = &model.Emission{
		ChannelID: 10,
		Status:    "running",
		PID:       12345,
	}
	emissionRepo.emissions[1].ID = 1

	// Also put a fake entry in processes map so it looks alive
	svc.processes.Store(uint(10), &struct{}{})

	status, err := svc.GetStatus(10)
	if err != nil {
		t.Fatalf("GetStatus() error: %v", err)
	}
	if !status.IsLive {
		t.Error("expected IsLive=true when process exists in map")
	}
	if status.StreamURL == "" {
		t.Error("expected StreamURL to be set when live")
	}
}

func TestEmissionService_GetStatus_ErrorStatus(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/test")

	emissionRepo.emissions[1] = &model.Emission{
		ChannelID: 20,
		Status:    "error",
		Error:     "ffmpeg crashed",
	}
	emissionRepo.emissions[1].ID = 1

	status, err := svc.GetStatus(20)
	if err != nil {
		t.Fatalf("GetStatus() error: %v", err)
	}
	if status.IsLive {
		t.Error("expected IsLive=false for error status")
	}
	if status.Error != "ffmpeg crashed" {
		t.Errorf("expected error message 'ffmpeg crashed', got %q", status.Error)
	}
}

// ============================================================================
// Emission — GetLiveChannelIDs
// ============================================================================

func TestEmissionService_GetLiveChannelIDs_MixedProcesses(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/test")

	// Two running emissions in DB
	emissionRepo.emissions[1] = &model.Emission{ChannelID: 1, Status: "running"}
	emissionRepo.emissions[1].ID = 1
	emissionRepo.emissions[2] = &model.Emission{ChannelID: 2, Status: "running"}
	emissionRepo.emissions[2].ID = 2

	// Only channel 1 has a real process
	svc.processes.Store(uint(1), &struct{}{})

	ids, err := svc.GetLiveChannelIDs()
	if err != nil {
		t.Fatalf("GetLiveChannelIDs() error: %v", err)
	}
	if len(ids) != 1 || ids[0] != 1 {
		t.Errorf("expected [1], got %v", ids)
	}
}

// ============================================================================
// Emission — upsertLiveStream
// ============================================================================

func TestEmissionService_UpsertLiveStream_CreateNew(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/test")

	// No existing streams for channel 5
	svc.upsertLiveStream(5)

	// Should have created a new stream
	streams, _ := streamRepo.ListByChannel(5)
	found := false
	for _, s := range streams {
		if s.URL == "/media/live/5/live.m3u8" {
			found = true
			if !s.IsActive {
				t.Error("new live stream should be active")
			}
		}
	}
	if !found {
		t.Error("upsertLiveStream should create a new stream")
	}
}

func TestEmissionService_UpsertLiveStream_UpdateExisting(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/test")

	// Pre-existing inactive live stream
	streamRepo.Create(&model.Stream{
		ChannelID: 8,
		URL:       "/media/live/8/live.m3u8",
		IsActive:  false,
	})

	// Should not create a second stream — it should find the existing one and update
	svc.upsertLiveStream(8)

	streams, _ := streamRepo.ListByChannel(8)
	// Should still be 1 stream (not 2) — upsert found existing and returned early
	if len(streams) != 1 {
		t.Errorf("expected 1 stream after upsert, got %d", len(streams))
	}
}

// ============================================================================
// LocalMedia — isValidVideoMimeType
// ============================================================================

func TestIsValidVideoMimeType_Extended(t *testing.T) {
	tests := []struct {
		mime string
		want bool
	}{
		{"video/mp4", true},
		{"video/x-matroska", true},
		{"video/webm", true},
		{"video/quicktime", true},
		{"video/x-flv", true},
		{"video/mp2t", true},
		{"video/x-m4v", true},
		{"video/x-ms-wmv", true},
		{"video/x-msvideo", true},
		{"application/octet-stream", true},
		{"text/html", false},
		{"image/png", false},
		{"audio/mp3", false},
		{"", false},
		// With charset parameter
		{"video/mp4; charset=utf-8", true},
		{"video/webm; codecs=vp8", true},
		{"text/html; charset=utf-8", false},
	}

	for _, tt := range tests {
		t.Run(tt.mime, func(t *testing.T) {
			got := isValidVideoMimeType(tt.mime)
			if got != tt.want {
				t.Errorf("isValidVideoMimeType(%q) = %v, want %v", tt.mime, got, tt.want)
			}
		})
	}
}

// ============================================================================
// LocalMedia — SafeResolvePath
// ============================================================================

func TestSafeResolvePath_Additional(t *testing.T) {
	svc := NewLocalMediaService(nil, nil, nil, "/media")

	tests := []struct {
		name     string
		base     string
		rel      string
		wantEmpty bool
	}{
		{"normal path", "/media", "uploads/file.mp4", false},
		{"traversal attempt", "/media", "../../etc/passwd", true},
		{"double dots", "/media", "../..", true},
		{"empty relative", "/media", "", false},
		{"subdirectory", "/media", "thumbnails/thumb.jpg", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.SafeResolvePath(tt.base, tt.rel)
			if tt.wantEmpty && result != "" {
				t.Errorf("SafeResolvePath(%q, %q) = %q, want empty", tt.base, tt.rel, result)
			}
			if !tt.wantEmpty && result == "" {
				t.Errorf("SafeResolvePath(%q, %q) = empty, want non-empty", tt.base, tt.rel)
			}
		})
	}
}

// ============================================================================
// Emission — StopAll with cleanup of live files
// ============================================================================

func TestEmissionService_StopAll_WithCleanup(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", t.TempDir())

	// Add emission entries that StopAll iterates via processes map
	// StopAll only processes entries in the processes sync.Map
	// Since we can't put real exec.Cmd, test with no processes
	svc.StopAll()
	// Should not panic
}

// ============================================================================
// Emission — deactivateLiveStream
// ============================================================================

func TestEmissionService_DeactivateLiveStream_NoStreams(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/test")

	// No streams exist for channel 99 — should not panic
	svc.deactivateLiveStream(99)
}

func TestEmissionService_DeactivateLiveStream_NonLiveStreams(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/test")

	// Add a non-live stream
	streamRepo.Create(&model.Stream{
		ChannelID: 4,
		URL:       "https://example.com/stream.m3u8",
		IsActive:  true,
	})

	svc.deactivateLiveStream(4)

	// Non-live stream should remain active
	streams, _ := streamRepo.ListByChannel(4)
	if len(streams) == 0 {
		t.Fatal("expected stream to still exist")
	}
	if !streams[0].IsActive {
		t.Error("non-live stream should remain active")
	}
}

// ============================================================================
// Emission — Stop with real exec.Cmd process (covers SIGTERM/Kill paths)
// ============================================================================

func TestEmissionService_Stop_WithRealProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", t.TempDir())

	// Start a real long-running process (sleep 60) so we can Stop it
	cmd := exec.Command("sleep", "60")
	if err := cmd.Start(); err != nil {
		t.Skipf("cannot start sleep process: %v", err)
	}

	// Store it in the processes map
	svc.processes.Store(uint(100), cmd)

	// Stop should send SIGTERM and clean it up
	err := svc.Stop(100)
	if err != nil {
		t.Fatalf("Stop() error: %v", err)
	}

	// Process should be gone from map
	if _, loaded := svc.processes.Load(uint(100)); loaded {
		t.Error("process should be removed from map after Stop")
	}
}

func TestEmissionService_Stop_WithRealProcess_NilProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", t.TempDir())

	// Create a cmd that hasn't been started (Process is nil)
	cmd := exec.Command("sleep", "60")
	// Don't call Start — cmd.Process will be nil

	svc.processes.Store(uint(200), cmd)

	// Stop should handle nil Process gracefully
	err := svc.Stop(200)
	if err != nil {
		t.Fatalf("Stop() error: %v", err)
	}
}

// ============================================================================
// Emission — StopAll with real processes
// ============================================================================

func TestEmissionService_StopAll_WithRealProcesses(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", t.TempDir())

	// Start two real processes
	cmd1 := exec.Command("sleep", "60")
	if err := cmd1.Start(); err != nil {
		t.Skipf("cannot start sleep process: %v", err)
	}
	cmd2 := exec.Command("sleep", "60")
	if err := cmd2.Start(); err != nil {
		cmd1.Process.Kill()
		t.Skipf("cannot start sleep process: %v", err)
	}

	svc.processes.Store(uint(10), cmd1)
	svc.processes.Store(uint(20), cmd2)

	// StopAll should stop both
	svc.StopAll()

	// Both should be removed from map
	count := 0
	svc.processes.Range(func(_, _ interface{}) bool {
		count++
		return true
	})
	if count != 0 {
		t.Errorf("expected 0 processes after StopAll, got %d", count)
	}
}

func TestEmissionService_StopAll_UpdatesEmissionDB(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", t.TempDir())

	cmd := exec.Command("sleep", "60")
	if err := cmd.Start(); err != nil {
		t.Skipf("cannot start sleep process: %v", err)
	}

	// Add emission in DB
	emissionRepo.emissions[1] = &model.Emission{
		ChannelID: 50,
		Status:    "running",
		PID:       cmd.Process.Pid,
	}
	emissionRepo.emissions[1].ID = 1

	svc.processes.Store(uint(50), cmd)
	svc.StopAll()

	// DB should be updated to stopped
	e := emissionRepo.emissions[1]
	if e.Status != "stopped" {
		t.Errorf("emission status = %q, want %q", e.Status, "stopped")
	}
}

// ============================================================================
// LibraryScanner — countVideoFiles
// ============================================================================

func TestLibraryScanner_CountVideoFiles(t *testing.T) {
	svc := &LibraryScannerService{}

	tmpDir := t.TempDir()

	// Create some video files
	for _, name := range []string{"movie.mp4", "show.mkv", "clip.avi", "doc.txt", "image.jpg"} {
		os.WriteFile(filepath.Join(tmpDir, name), []byte("fake"), 0644)
	}

	// Create a subdirectory with more video files
	subDir := filepath.Join(tmpDir, "subdir")
	os.MkdirAll(subDir, 0755)
	os.WriteFile(filepath.Join(subDir, "nested.webm"), []byte("fake"), 0644)

	count := svc.countVideoFiles(tmpDir)
	if count != 4 { // mp4, mkv, avi, webm
		t.Errorf("countVideoFiles() = %d, want 4", count)
	}
}

func TestLibraryScanner_CountVideoFiles_EmptyDir(t *testing.T) {
	svc := &LibraryScannerService{}
	tmpDir := t.TempDir()

	count := svc.countVideoFiles(tmpDir)
	if count != 0 {
		t.Errorf("countVideoFiles() = %d, want 0", count)
	}
}

func TestLibraryScanner_CountVideoFiles_NonexistentDir(t *testing.T) {
	svc := &LibraryScannerService{}

	count := svc.countVideoFiles("/tmp/definitely-nonexistent-dir-12345")
	if count != 0 {
		t.Errorf("countVideoFiles() = %d, want 0", count)
	}
}

func TestLibraryScanner_CountVideoFiles_AllExtensions(t *testing.T) {
	svc := &LibraryScannerService{}
	tmpDir := t.TempDir()

	// Test all video extensions
	exts := []string{".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".mpg", ".mpeg", ".3gp"}
	for i, ext := range exts {
		os.WriteFile(filepath.Join(tmpDir, fmt.Sprintf("video%d%s", i, ext)), []byte("fake"), 0644)
	}

	count := svc.countVideoFiles(tmpDir)
	if count != len(exts) {
		t.Errorf("countVideoFiles() = %d, want %d", count, len(exts))
	}
}

// ============================================================================
// IPTVSeeder — importEPG with gzip
// ============================================================================

func TestIPTVSeeder_ImportEPG_Gzip(t *testing.T) {
	epgXML := `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="ch1">
    <display-name>Channel 1</display-name>
  </channel>
  <programme start="20260321120000 +0000" stop="20260321130000 +0000" channel="ch1">
    <title>Test Show</title>
    <desc>Test description</desc>
  </programme>
</tv>`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		gz := gzip.NewWriter(w)
		gz.Write([]byte(epgXML))
		gz.Close()
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	channelIDMap := map[string]uint{"ch1": 1}
	seeder.importEPG(server.URL, channelIDMap)

	// EPG entries should have been imported
	if len(epgRepo.entries) == 0 {
		t.Error("expected EPG entries to be imported")
	}
}

func TestIPTVSeeder_ImportEPG_GzipURL(t *testing.T) {
	epgXML := `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="ch1">
    <display-name>Channel 1</display-name>
  </channel>
  <programme start="20260321120000 +0000" stop="20260321130000 +0000" channel="ch1">
    <title>Test Show</title>
  </programme>
</tv>`

	// Server at .gz URL
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gz := gzip.NewWriter(w)
		gz.Write([]byte(epgXML))
		gz.Close()
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	channelIDMap := map[string]uint{"ch1": 1}
	// Use URL ending in .gz to trigger gzip decoding via URL suffix
	seeder.importEPG(server.URL+"/guide.xml.gz", channelIDMap)
}

func TestIPTVSeeder_ImportEPG_HTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Should not panic on HTTP error
	seeder.importEPG(server.URL, map[string]uint{})
}

func TestIPTVSeeder_ImportEPG_BadXML(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte("not xml at all"))
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Should not panic on invalid XML
	seeder.importEPG(server.URL, map[string]uint{})
}

func TestIPTVSeeder_ImportEPG_NetworkError(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Should not panic on network error
	seeder.importEPG("http://127.0.0.1:1/nonexistent", map[string]uint{})
}

// ============================================================================
// IPTVSeeder — buildCategories edge cases
// ============================================================================

func TestIPTVSeeder_BuildCategories_EmptyGroup(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	entries := []m3uEntry{
		{GroupTitle: "", TvgName: "Channel 1", URL: "http://example.com/1"},
	}

	catMap := seeder.buildCategories(entries)
	if _, ok := catMap["Sin Categoría"]; !ok {
		t.Error("expected 'Sin Categoría' for empty group title")
	}
}

func TestIPTVSeeder_BuildCategories_ExistingCat(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Pre-create a category
	categoryRepo.Create(&model.Category{Name: "News", Slug: "news", Type: "live"})

	entries := []m3uEntry{
		{GroupTitle: "News", TvgName: "CNN", URL: "http://example.com/cnn"},
	}

	catMap := seeder.buildCategories(entries)
	if cat, ok := catMap["News"]; !ok || cat == nil {
		t.Error("expected 'News' category to be found from existing")
	}
}

func TestIPTVSeeder_BuildCategories_MultipleGroups(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	entries := []m3uEntry{
		{GroupTitle: "News", TvgName: "CNN", URL: "http://example.com/cnn"},
		{GroupTitle: "Sports", TvgName: "ESPN", URL: "http://example.com/espn"},
		{GroupTitle: "News", TvgName: "BBC News", URL: "http://example.com/bbc"}, // duplicate group
	}

	catMap := seeder.buildCategories(entries)
	if len(catMap) != 2 {
		t.Errorf("expected 2 categories, got %d", len(catMap))
	}
}

// ============================================================================
// IPTVSeeder — SeedFromURL with existing channels (skip)
// ============================================================================

func TestIPTVSeeder_SeedFromURL_ExistingChannels_NoSeed(t *testing.T) {
	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	// Pre-add channels so SeedFromURL skips
	channelRepo.Create(&model.Channel{Name: "Existing", Slug: "existing"})

	seeder.SeedFromURL("http://example.com/m3u")
	// Should not have imported anything
}

// ============================================================================
// IPTVSeeder — ImportWithOptionsContext cancellation
// ============================================================================

func TestIPTVSeeder_ImportWithOptionsContext_CancelledEarly(t *testing.T) {
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

	// Cancel immediately
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	seeder.ImportWithOptionsContext(ctx, IPTVImportOptions{
		M3UURL: server.URL,
		Source: "test",
	})

	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running after cancelled import")
	}
}

// ============================================================================
// IPTVSeeder — ImportWithOptions (wrapper)
// ============================================================================

func TestIPTVSeeder_ImportWithOptions(t *testing.T) {
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

	seeder.ImportWithOptions(IPTVImportOptions{
		M3UURL: server.URL,
		Source: "test",
	})

	status := seeder.GetStatus()
	if status.Running {
		t.Error("should not be running after import")
	}
	if status.Imported == 0 {
		t.Error("expected at least 1 channel imported")
	}
}

// ============================================================================
// IPTVSeeder — EPG with multiple programmes in batches
// ============================================================================

func TestIPTVSeeder_ImportEPG_MultipleProgrammes(t *testing.T) {
	epgXML := `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="ch1"><display-name>Channel 1</display-name></channel>`

	// Add 250+ programmes to test the batch loop
	for i := 0; i < 250; i++ {
		epgXML += fmt.Sprintf(`
  <programme start="20260320%02d0000 +0000" stop="20260320%02d3000 +0000" channel="ch1">
    <title>Show %d</title>
  </programme>`, i%24, i%24, i)
	}
	epgXML += `</tv>`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(epgXML))
	}))
	defer server.Close()

	channelRepo := newMockChannelRepoForIPTV()
	streamRepo := newMockStreamRepoForEmission()
	categoryRepo := newMockCategoryRepoForIPTV()
	epgRepo := newMockEPGRepo()
	seeder := NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	channelIDMap := map[string]uint{"ch1": 1}
	seeder.importEPG(server.URL, channelIDMap)

	// Should have imported programmes (filtering by future dates)
	if len(epgRepo.entries) == 0 {
		t.Error("expected EPG entries to be imported")
	}
}

// ============================================================================
// Transcoder — NewTranscoderService
// ============================================================================

func TestNewTranscoderService_DefaultFFprobe(t *testing.T) {
	svc := NewTranscoderService(nil, "/usr/bin/ffmpeg", "", "/media")
	if svc.FFprobePath != "/usr/bin/ffprobe" {
		t.Errorf("FFprobePath = %q, want /usr/bin/ffprobe", svc.FFprobePath)
	}
}

func TestNewTranscoderService_ExplicitFFprobe(t *testing.T) {
	svc := NewTranscoderService(nil, "/usr/bin/ffmpeg", "/custom/ffprobe", "/media")
	if svc.FFprobePath != "/custom/ffprobe" {
		t.Errorf("FFprobePath = %q, want /custom/ffprobe", svc.FFprobePath)
	}
}

func TestNewTranscoderService_FallbackFFprobe(t *testing.T) {
	// When ffmpegPath doesn't contain "ffmpeg", fallback to "ffprobe"
	svc := NewTranscoderService(nil, "/usr/bin/custom-encoder", "", "/media")
	if svc.FFprobePath != "ffprobe" {
		t.Errorf("FFprobePath = %q, want ffprobe", svc.FFprobePath)
	}
}

func TestTranscoderService_SetHub_Coverage(t *testing.T) {
	svc := NewTranscoderService(nil, "ffmpeg", "ffprobe", "/media")
	hub := ws.NewHub()
	svc.SetHub(hub)
	if svc.hub != hub {
		t.Error("SetHub should set the hub")
	}
}

func TestTranscoderService_MaxConcurrentTranscodes(t *testing.T) {
	if MaxConcurrentTranscodes != 4 {
		t.Errorf("MaxConcurrentTranscodes = %d, want 4", MaxConcurrentTranscodes)
	}
}
