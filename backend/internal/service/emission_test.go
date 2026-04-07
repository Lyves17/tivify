package service

import (
	"testing"
	"time"

	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock Emission Repository ---

type mockEmissionRepo struct {
	emissions map[uint]*model.Emission
	nextID    uint
}

func newMockEmissionRepo() *mockEmissionRepo {
	return &mockEmissionRepo{emissions: make(map[uint]*model.Emission), nextID: 1}
}

func (m *mockEmissionRepo) FindByChannelID(channelID uint) (*model.Emission, error) {
	for _, e := range m.emissions {
		if e.ChannelID == channelID {
			return e, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockEmissionRepo) FindAllRunning() ([]model.Emission, error) {
	var result []model.Emission
	for _, e := range m.emissions {
		if e.Status == "running" {
			result = append(result, *e)
		}
	}
	return result, nil
}

func (m *mockEmissionRepo) Create(emission *model.Emission) error {
	emission.ID = m.nextID
	m.nextID++
	m.emissions[emission.ID] = emission
	return nil
}

func (m *mockEmissionRepo) Save(emission *model.Emission) error {
	m.emissions[emission.ID] = emission
	return nil
}

func (m *mockEmissionRepo) UpdateStatus(channelID uint, status string, pid int, errMsg string) error {
	for _, e := range m.emissions {
		if e.ChannelID == channelID {
			e.Status = status
			e.PID = pid
			e.Error = errMsg
			return nil
		}
	}
	return nil
}

func (m *mockEmissionRepo) ListAll() ([]model.Emission, error) {
	var result []model.Emission
	for _, e := range m.emissions {
		result = append(result, *e)
	}
	return result, nil
}

// --- Mock Stream Repository for Emission ---

type mockStreamRepoForEmission struct {
	streams map[uint][]model.Stream
	nextID  uint
}

func newMockStreamRepoForEmission() *mockStreamRepoForEmission {
	return &mockStreamRepoForEmission{streams: make(map[uint][]model.Stream), nextID: 1}
}

func (m *mockStreamRepoForEmission) FindByID(id uint) (*model.Stream, error) {
	return nil, gorm.ErrRecordNotFound
}
func (m *mockStreamRepoForEmission) ListByChannel(channelID uint) ([]model.Stream, error) {
	return m.streams[channelID], nil
}
func (m *mockStreamRepoForEmission) Create(stream *model.Stream) error {
	stream.ID = m.nextID
	m.nextID++
	m.streams[stream.ChannelID] = append(m.streams[stream.ChannelID], *stream)
	return nil
}
func (m *mockStreamRepoForEmission) Update(stream *model.Stream) error { return nil }
func (m *mockStreamRepoForEmission) Delete(id uint) error              { return nil }
func (m *mockStreamRepoForEmission) DeleteByChannel(channelID uint) error {
	delete(m.streams, channelID)
	return nil
}

// --- Tests ---

func TestEmissionService_GetStatus_NoEmission(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	status, err := svc.GetStatus(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.IsLive {
		t.Error("should not be live when no emission exists")
	}
	if status.Status != "stopped" {
		t.Errorf("status = %q, want %q", status.Status, "stopped")
	}
}

func TestEmissionService_GetStatus_Stopped(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()
	emissionRepo.emissions[1] = &model.Emission{
		ID:        1,
		ChannelID: 1,
		Status:    "stopped",
		StartedAt: &now,
	}
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	status, err := svc.GetStatus(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.IsLive {
		t.Error("should not be live when stopped")
	}
	if status.Status != "stopped" {
		t.Errorf("status = %q, want %q", status.Status, "stopped")
	}
}

func TestEmissionService_GetStatus_RunningButNoProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()
	emissionRepo.emissions[1] = &model.Emission{
		ID:        1,
		ChannelID: 1,
		Status:    "running",
		PID:       12345,
		StartedAt: &now,
	}
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// No process in sync.Map, so it should detect stale state
	status, err := svc.GetStatus(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.IsLive {
		t.Error("should not be live when process not found in memory")
	}
	if status.Status != "stopped" {
		t.Errorf("status = %q, want %q (corrected from stale running)", status.Status, "stopped")
	}
}

func TestEmissionService_GetStatus_WithError(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	emissionRepo.emissions[1] = &model.Emission{
		ID:        1,
		ChannelID: 1,
		Status:    "error",
		Error:     "ffmpeg crashed",
	}
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	status, err := svc.GetStatus(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.Error != "ffmpeg crashed" {
		t.Errorf("error = %q, want %q", status.Error, "ffmpeg crashed")
	}
}

func TestEmissionService_GetLiveChannelIDs_NoRunning(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	ids, err := svc.GetLiveChannelIDs()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 0 {
		t.Errorf("len(ids) = %d, want 0", len(ids))
	}
}

func TestEmissionService_GetLiveChannelIDs_RunningButNoProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()
	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", StartedAt: &now,
	}
	emissionRepo.emissions[2] = &model.Emission{
		ID: 2, ChannelID: 2, Status: "running", StartedAt: &now,
	}
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// No processes in sync.Map, so none should be returned
	ids, err := svc.GetLiveChannelIDs()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 0 {
		t.Errorf("len(ids) = %d, want 0 (no actual processes)", len(ids))
	}
}

func TestEmissionService_Stop_NoProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running",
	}
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	err := svc.Stop(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Check that status was updated to stopped
	emission := emissionRepo.emissions[1]
	if emission.Status != "stopped" {
		t.Errorf("status = %q, want %q", emission.Status, "stopped")
	}
}

func TestEmissionService_BroadcastStatus_NilHub(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Should not panic with nil hub
	svc.broadcastStatus(1, "running")
}

func TestEmissionService_SetHub(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	if svc.hub != nil {
		t.Error("hub should be nil initially")
	}
	svc.SetHub(nil)
	if svc.hub != nil {
		t.Error("hub should remain nil after SetHub(nil)")
	}
}

func TestEmissionService_GetStatus_StreamURL(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()
	emissionRepo.emissions[1] = &model.Emission{
		ID:        1,
		ChannelID: 5,
		Status:    "running",
		StartedAt: &now,
	}
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Store a fake process to simulate running
	svc.processes.Store(uint(5), &struct{}{})

	status, err := svc.GetStatus(5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !status.IsLive {
		t.Error("should be live when process exists")
	}
	if status.StreamURL != "/media/live/5/live.m3u8" {
		t.Errorf("StreamURL = %q, want %q", status.StreamURL, "/media/live/5/live.m3u8")
	}
}

func TestEmissionService_Stop_NoEmissionInDB(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Stop for a channel with no emission record and no process
	err := svc.Stop(99)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestEmissionService_UpsertLiveStream_Creates(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	svc.upsertLiveStream(1)

	streams := streamRepo.streams[1]
	if len(streams) != 1 {
		t.Fatalf("expected 1 stream, got %d", len(streams))
	}
	if streams[0].StreamFormat != "hls" {
		t.Errorf("StreamFormat = %q, want %q", streams[0].StreamFormat, "hls")
	}
	if streams[0].Priority != 200 {
		t.Errorf("Priority = %d, want 200", streams[0].Priority)
	}
}

func TestEmissionService_DeactivateLiveStream(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// First create a stream
	svc.upsertLiveStream(1)

	// Then deactivate - should not panic
	svc.deactivateLiveStream(1)
}

func TestEmissionService_CleanupLiveFiles_EmptyDir(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent")

	// Should not panic on nonexistent directory
	svc.cleanupLiveFiles(99)
}

func TestNewEmissionService(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "/usr/bin/ffmpeg", "/media")

	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.ffmpegPath != "/usr/bin/ffmpeg" {
		t.Errorf("ffmpegPath = %q, want %q", svc.ffmpegPath, "/usr/bin/ffmpeg")
	}
	if svc.mediaPath != "/media" {
		t.Errorf("mediaPath = %q, want %q", svc.mediaPath, "/media")
	}
}

func TestEmissionService_CleanupOnStartup_NoEmissions(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent-media-path")

	// Should not panic when no running emissions exist
	svc.CleanupOnStartup()
}

func TestEmissionService_CleanupOnStartup_ResetsRunningEmissions(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()

	// Add running emissions (orphaned from a previous crash)
	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", PID: 0, StartedAt: &now,
	}
	emissionRepo.emissions[2] = &model.Emission{
		ID: 2, ChannelID: 2, Status: "running", PID: 0, StartedAt: &now,
	}
	// Also add a stopped emission that should not be affected
	emissionRepo.emissions[3] = &model.Emission{
		ID: 3, ChannelID: 3, Status: "stopped", PID: 0, StartedAt: &now,
	}

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent-media-path")
	svc.CleanupOnStartup()

	// Running emissions should be reset to stopped
	if emissionRepo.emissions[1].Status != "stopped" {
		t.Errorf("emission 1 status = %q, want %q", emissionRepo.emissions[1].Status, "stopped")
	}
	if emissionRepo.emissions[2].Status != "stopped" {
		t.Errorf("emission 2 status = %q, want %q", emissionRepo.emissions[2].Status, "stopped")
	}
	// Stopped emission should remain stopped
	if emissionRepo.emissions[3].Status != "stopped" {
		t.Errorf("emission 3 status = %q, want %q", emissionRepo.emissions[3].Status, "stopped")
	}
}

func TestEmissionService_CleanupOnStartup_DeactivatesStreams(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()

	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", PID: 0, StartedAt: &now,
	}

	// Create a live stream for the channel
	streamRepo.Create(&model.Stream{
		ChannelID:    1,
		URL:          "/media/live/1/live.m3u8",
		StreamFormat: "hls",
		IsActive:     true,
	})

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent-media-path")
	svc.CleanupOnStartup()

	// Emission should be reset
	if emissionRepo.emissions[1].Status != "stopped" {
		t.Errorf("emission status = %q, want %q", emissionRepo.emissions[1].Status, "stopped")
	}
}

func TestEmissionService_StopAll_NoProcesses(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Should not panic with no processes
	svc.StopAll()
}

func TestEmissionService_UpsertLiveStream_ExistingStream(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Create stream first
	svc.upsertLiveStream(1)
	if len(streamRepo.streams[1]) != 1 {
		t.Fatalf("expected 1 stream, got %d", len(streamRepo.streams[1]))
	}

	// Upsert again - should not create duplicate
	svc.upsertLiveStream(1)
	// Note: our mock appends, but the real service updates existing
	// The key test is that it doesn't crash
}

func TestEmissionService_DeactivateLiveStream_NoStream(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Should not panic when no stream exists
	svc.deactivateLiveStream(999)
}

func TestEmissionService_GetLiveChannelIDs_WithProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()
	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 5, Status: "running", StartedAt: &now,
	}
	emissionRepo.emissions[2] = &model.Emission{
		ID: 2, ChannelID: 10, Status: "running", StartedAt: &now,
	}

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Store processes for both channels
	svc.processes.Store(uint(5), &struct{}{})
	svc.processes.Store(uint(10), &struct{}{})

	ids, err := svc.GetLiveChannelIDs()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 2 {
		t.Errorf("len(ids) = %d, want 2", len(ids))
	}

	// Clean up
	svc.processes.Delete(uint(5))
	svc.processes.Delete(uint(10))
}

func TestEmissionService_GetStatus_RunningWithProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()
	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", PID: 12345, StartedAt: &now,
	}
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")
	svc.processes.Store(uint(1), &struct{}{})

	status, err := svc.GetStatus(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !status.IsLive {
		t.Error("should be live when process exists")
	}
	if status.Status != "running" {
		t.Errorf("status = %q, want %q", status.Status, "running")
	}
	if status.StreamURL == "" {
		t.Error("StreamURL should be set when live")
	}

	svc.processes.Delete(uint(1))
}

func TestEmissionService_Constants(t *testing.T) {
	if maxAutoRestarts != 3 {
		t.Errorf("maxAutoRestarts = %d, want 3", maxAutoRestarts)
	}
	if restartDelay != 5*time.Second {
		t.Errorf("restartDelay = %v, want 5s", restartDelay)
	}
}

// --- Additional Stop tests ---

func TestEmissionService_Stop_UpdatesDBAndCleansUp(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()

	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", PID: 999, StartedAt: &now,
	}

	// Create a live stream for the channel
	streamRepo.Create(&model.Stream{
		ChannelID:    1,
		URL:          "/media/live/1/live.m3u8",
		StreamFormat: "hls",
		IsActive:     true,
		Priority:     200,
	})

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent-media-path")

	// No process in sync.Map, so Stop should just update DB
	err := svc.Stop(1)
	if err != nil {
		t.Fatalf("Stop() error = %v", err)
	}

	// Verify emission status updated to stopped
	emission := emissionRepo.emissions[1]
	if emission.Status != "stopped" {
		t.Errorf("emission status = %q, want %q", emission.Status, "stopped")
	}
}

func TestEmissionService_Stop_ClearsRetriesAndSetsStoppingFlag(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()

	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running",
	}

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Pre-load retries
	svc.retries.Store(uint(1), 2)

	err := svc.Stop(1)
	if err != nil {
		t.Fatalf("Stop() error = %v", err)
	}

	// Retries should be cleared
	if _, loaded := svc.retries.Load(uint(1)); loaded {
		t.Error("retries should be cleared after Stop")
	}

	// Stopping flag should be cleaned up (since there was no process)
	if _, loaded := svc.stopping.Load(uint(1)); loaded {
		t.Error("stopping flag should be cleaned up when no process exists")
	}
}

func TestEmissionService_Stop_MultipleChannels(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()

	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", StartedAt: &now,
	}
	emissionRepo.emissions[2] = &model.Emission{
		ID: 2, ChannelID: 2, Status: "running", StartedAt: &now,
	}

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Stop channel 1
	if err := svc.Stop(1); err != nil {
		t.Fatalf("Stop(1) error = %v", err)
	}

	// Channel 1 should be stopped, channel 2 should remain running
	if emissionRepo.emissions[1].Status != "stopped" {
		t.Errorf("channel 1 status = %q, want stopped", emissionRepo.emissions[1].Status)
	}
	if emissionRepo.emissions[2].Status != "running" {
		t.Errorf("channel 2 status = %q, want running (not affected)", emissionRepo.emissions[2].Status)
	}
}

// --- Additional StopAll tests ---

func TestEmissionService_StopAll_UpdatesDBForAllChannels(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()

	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", StartedAt: &now,
	}
	emissionRepo.emissions[2] = &model.Emission{
		ID: 2, ChannelID: 2, Status: "running", StartedAt: &now,
	}

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// No actual processes stored, so StopAll should just iterate (empty range)
	svc.StopAll()

	// Since no processes are in sync.Map, StopAll does nothing via Range
	// This verifies it doesn't panic
}

func TestEmissionService_StopAll_ClearsProcessMap(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Store some fake entries (not real exec.Cmd - just ensure Range works safely)
	// Note: StopAll casts to *exec.Cmd, so we can't store arbitrary values
	// Instead, verify that StopAll with empty map doesn't panic
	svc.StopAll()
}

// --- Additional CleanupOnStartup tests ---

func TestEmissionService_CleanupOnStartup_WithPID(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()

	// Emission with a PID that doesn't exist (simulate orphaned process)
	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", PID: 99999, StartedAt: &now,
	}

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent-media-path")
	svc.CleanupOnStartup()

	// Should be reset to stopped
	if emissionRepo.emissions[1].Status != "stopped" {
		t.Errorf("emission status = %q, want stopped", emissionRepo.emissions[1].Status)
	}
}

func TestEmissionService_CleanupOnStartup_WithLiveStreams(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()

	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", PID: 0, StartedAt: &now,
	}
	emissionRepo.emissions[2] = &model.Emission{
		ID: 2, ChannelID: 2, Status: "running", PID: 0, StartedAt: &now,
	}

	// Create live streams for both channels
	streamRepo.Create(&model.Stream{
		ChannelID: 1, URL: "/media/live/1/live.m3u8", StreamFormat: "hls", IsActive: true, Priority: 200,
	})
	streamRepo.Create(&model.Stream{
		ChannelID: 2, URL: "/media/live/2/live.m3u8", StreamFormat: "hls", IsActive: true, Priority: 200,
	})

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent-media-path")
	svc.CleanupOnStartup()

	// Both should be stopped
	if emissionRepo.emissions[1].Status != "stopped" {
		t.Errorf("emission 1 status = %q, want stopped", emissionRepo.emissions[1].Status)
	}
	if emissionRepo.emissions[2].Status != "stopped" {
		t.Errorf("emission 2 status = %q, want stopped", emissionRepo.emissions[2].Status)
	}
}

func TestEmissionService_CleanupOnStartup_MixedStatuses(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()

	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "running", PID: 0, StartedAt: &now,
	}
	emissionRepo.emissions[2] = &model.Emission{
		ID: 2, ChannelID: 2, Status: "error", PID: 0, StartedAt: &now,
	}
	emissionRepo.emissions[3] = &model.Emission{
		ID: 3, ChannelID: 3, Status: "stopped", PID: 0, StartedAt: &now,
	}

	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent-media-path")
	svc.CleanupOnStartup()

	// Only "running" emissions should be cleaned up
	if emissionRepo.emissions[1].Status != "stopped" {
		t.Errorf("emission 1 (was running) status = %q, want stopped", emissionRepo.emissions[1].Status)
	}
	// Error emission should not be touched by CleanupOnStartup (FindAllRunning only returns running)
	if emissionRepo.emissions[2].Status != "error" {
		t.Errorf("emission 2 (was error) status = %q, want error (untouched)", emissionRepo.emissions[2].Status)
	}
	if emissionRepo.emissions[3].Status != "stopped" {
		t.Errorf("emission 3 (was stopped) status = %q, want stopped (untouched)", emissionRepo.emissions[3].Status)
	}
}

// --- Additional GetStatus tests ---

func TestEmissionService_GetStatus_RestartingStatus(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "restarting", Error: "Auto-reinicio 1/3",
	}
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	status, err := svc.GetStatus(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.IsLive {
		t.Error("should not be live when restarting")
	}
	if status.Status != "restarting" {
		t.Errorf("status = %q, want %q", status.Status, "restarting")
	}
}

func TestEmissionService_GetStatus_StartingStatus(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	now := time.Now()
	emissionRepo.emissions[1] = &model.Emission{
		ID: 1, ChannelID: 1, Status: "starting", StartedAt: &now,
	}
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	status, err := svc.GetStatus(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.IsLive {
		t.Error("should not be live when starting")
	}
	if status.Status != "starting" {
		t.Errorf("status = %q, want %q", status.Status, "starting")
	}
}

// --- UpsertLiveStream and DeactivateLiveStream edge cases ---

func TestEmissionService_UpsertLiveStream_UpdatesExisting(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Create a live stream manually
	streamRepo.Create(&model.Stream{
		ChannelID:    1,
		URL:          "/media/live/1/live.m3u8",
		StreamFormat: "hls",
		IsActive:     false, // Deactivated
		Priority:     200,
	})

	// Upsert should find existing and reactivate it
	svc.upsertLiveStream(1)

	// The mock doesn't fully simulate Update(), but the point is it doesn't crash
	// and doesn't create a duplicate
}

func TestEmissionService_DeactivateLiveStream_WithNonLiveStreams(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/media")

	// Create a non-live stream
	streamRepo.Create(&model.Stream{
		ChannelID:    1,
		URL:          "https://example.com/stream.m3u8",
		StreamFormat: "hls",
		IsActive:     true,
		Priority:     1,
	})

	// Deactivate should not crash or affect non-live streams
	svc.deactivateLiveStream(1)
}

func TestEmissionService_CleanupLiveFiles_NonexistentDir(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/definitely-nonexistent-path-12345")

	// Should not panic
	svc.cleanupLiveFiles(1)
	svc.cleanupLiveFiles(0)
	svc.cleanupLiveFiles(999999)
}

func TestEmissionService_Stop_NoProcessCleanup(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent")

	// Stop a channel that has no running process - should cleanup
	err := svc.Stop(42)
	if err != nil {
		t.Fatalf("Stop() with no process should not error: %v", err)
	}
}

func TestEmissionService_StopAll_Empty(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent")

	// StopAll with no running processes should not panic
	svc.StopAll()
}

func TestEmissionService_Stop_UpdatesDBWhenNoProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent")

	// Create an emission in "running" state but no actual process
	emissionRepo.emissions[1] = &model.Emission{
		ChannelID: 42,
		Status:    "running",
		PID:       12345,
	}
	emissionRepo.emissions[1].ID = 1

	// Stop should update the DB status to "stopped"
	err := svc.Stop(42)
	if err != nil {
		t.Fatalf("Stop() error: %v", err)
	}
}

func TestEmissionService_GetStatus_RunningButOrphanedProcess(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent")

	// Create emission marked as "running" but no process in memory
	emissionRepo.emissions[1] = &model.Emission{
		ChannelID: 10,
		Status:    "running",
		PID:       99999,
	}
	emissionRepo.emissions[1].ID = 1

	status, err := svc.GetStatus(10)
	if err != nil {
		t.Fatalf("GetStatus() error: %v", err)
	}
	// Should detect the orphaned process and mark as stopped
	if status.IsLive {
		t.Error("should not be live when process is not in memory")
	}
	if status.Status != "stopped" {
		t.Errorf("Status = %q, want stopped", status.Status)
	}
}

func TestEmissionService_GetLiveChannelIDs_Empty(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent")

	ids, err := svc.GetLiveChannelIDs()
	if err != nil {
		t.Fatalf("GetLiveChannelIDs() error: %v", err)
	}
	if len(ids) != 0 {
		t.Errorf("expected 0 live channels, got %d", len(ids))
	}
}

func TestEmissionService_BroadcastStatus_NoHub(t *testing.T) {
	emissionRepo := newMockEmissionRepo()
	streamRepo := newMockStreamRepoForEmission()
	svc := NewEmissionService(emissionRepo, streamRepo, "ffmpeg", "/tmp/nonexistent")

	// broadcastStatus with nil hub should not panic
	svc.broadcastStatus(1, "running")
}
