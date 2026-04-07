package service

import (
	"testing"

	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock LocalMedia Repository for Transcoder ---

type mockLocalMediaRepoForTranscoder struct {
	media  map[uint]*model.LocalMedia
	nextID uint
}

func newMockLocalMediaRepoForTranscoder() *mockLocalMediaRepoForTranscoder {
	return &mockLocalMediaRepoForTranscoder{media: make(map[uint]*model.LocalMedia), nextID: 1}
}

func (m *mockLocalMediaRepoForTranscoder) Create(media *model.LocalMedia) error {
	media.ID = m.nextID
	m.nextID++
	m.media[media.ID] = media
	return nil
}

func (m *mockLocalMediaRepoForTranscoder) FindByID(id uint) (*model.LocalMedia, error) {
	media, ok := m.media[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return media, nil
}

func (m *mockLocalMediaRepoForTranscoder) List(page, perPage int) ([]model.LocalMedia, int64, error) {
	return nil, 0, nil
}

func (m *mockLocalMediaRepoForTranscoder) Update(media *model.LocalMedia) error {
	m.media[media.ID] = media
	return nil
}

func (m *mockLocalMediaRepoForTranscoder) UpdateStatus(id uint, status string, progress int, errorMsg string) error {
	if media, ok := m.media[id]; ok {
		media.Status = status
		media.Progress = progress
		media.ErrorMessage = errorMsg
	}
	return nil
}

func (m *mockLocalMediaRepoForTranscoder) Delete(id uint) error {
	delete(m.media, id)
	return nil
}

func (m *mockLocalMediaRepoForTranscoder) FindPendingTranscodes() ([]model.LocalMedia, error) {
	var result []model.LocalMedia
	for _, media := range m.media {
		if media.Status == "pending" || media.Status == "processing" {
			result = append(result, *media)
		}
	}
	return result, nil
}

func (m *mockLocalMediaRepoForTranscoder) ListRecent(limit int) ([]model.LocalMedia, error) {
	return nil, nil
}

// --- Tests ---

func TestNewTranscoderService(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	svc := NewTranscoderService(repo, "/usr/bin/ffmpeg", "", "/tmp/media")

	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.FFprobePath != "/usr/bin/ffprobe" {
		t.Errorf("FFprobePath = %q, want %q", svc.FFprobePath, "/usr/bin/ffprobe")
	}
}

func TestNewTranscoderService_CustomFFprobe(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	svc := NewTranscoderService(repo, "/usr/bin/ffmpeg", "/custom/ffprobe", "/tmp/media")

	if svc.FFprobePath != "/custom/ffprobe" {
		t.Errorf("FFprobePath = %q, want %q", svc.FFprobePath, "/custom/ffprobe")
	}
}

func TestNewTranscoderService_SemaphoreCapacity(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	svc := NewTranscoderService(repo, "ffmpeg", "", "/tmp/media")

	if cap(svc.semaphore) != MaxConcurrentTranscodes {
		t.Errorf("semaphore capacity = %d, want %d", cap(svc.semaphore), MaxConcurrentTranscodes)
	}
}

func TestTranscoderService_SetHub(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	svc := NewTranscoderService(repo, "ffmpeg", "", "/tmp/media")

	if svc.hub != nil {
		t.Error("hub should be nil initially")
	}
	// SetHub with nil is a no-op but valid
	svc.SetHub(nil)
	if svc.hub != nil {
		t.Error("hub should remain nil after SetHub(nil)")
	}
}

func TestScanCRLF(t *testing.T) {
	tests := []struct {
		name  string
		input []byte
		atEOF bool
		wantA int    // advance
		wantT string // token
	}{
		{"newline", []byte("hello\nworld"), false, 6, "hello"},
		{"cr", []byte("hello\rworld"), false, 6, "hello"},
		{"crlf", []byte("hello\r\nworld"), false, 7, "hello"},
		{"eof", []byte("hello"), true, 5, "hello"},
		{"empty_eof", []byte{}, true, 0, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			advance, token, _ := scanCRLF(tt.input, tt.atEOF)
			if advance != tt.wantA {
				t.Errorf("advance = %d, want %d", advance, tt.wantA)
			}
			got := ""
			if token != nil {
				got = string(token)
			}
			if got != tt.wantT {
				t.Errorf("token = %q, want %q", got, tt.wantT)
			}
		})
	}
}

func TestTimeRegex(t *testing.T) {
	line := "frame= 1234 fps= 30 q=28.0 size=   5120kB time=01:23:45.67 bitrate= 1024.0kbits/s"
	matches := timeRegex.FindStringSubmatch(line)
	if len(matches) != 5 {
		t.Fatalf("expected 5 matches, got %d", len(matches))
	}
	if matches[1] != "01" || matches[2] != "23" || matches[3] != "45" || matches[4] != "67" {
		t.Errorf("matches = %v, want [01 23 45 67]", matches[1:])
	}
}

func TestTimeRegex_Various(t *testing.T) {
	tests := []struct {
		name    string
		line    string
		wantH   string
		wantM   string
		wantS   string
		noMatch bool
	}{
		{"standard", "time=00:05:30.12", "00", "05", "30", false},
		{"long_hours", "time=12:34:56.78", "12", "34", "56", false},
		{"zero", "time=00:00:00.00", "00", "00", "00", false},
		{"no_time", "frame= 1234 fps= 30", "", "", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matches := timeRegex.FindStringSubmatch(tt.line)
			if tt.noMatch {
				if len(matches) > 0 {
					t.Errorf("expected no match, got %v", matches)
				}
				return
			}
			if len(matches) < 5 {
				t.Fatalf("expected 5 matches, got %d", len(matches))
			}
			if matches[1] != tt.wantH || matches[2] != tt.wantM || matches[3] != tt.wantS {
				t.Errorf("got h=%s m=%s s=%s, want h=%s m=%s s=%s",
					matches[1], matches[2], matches[3], tt.wantH, tt.wantM, tt.wantS)
			}
		})
	}
}

func TestNewTranscoderService_FFprobeDerivation(t *testing.T) {
	tests := []struct {
		name        string
		ffmpegPath  string
		ffprobePath string
		wantProbe   string
	}{
		{"derive_from_ffmpeg", "/usr/bin/ffmpeg", "", "/usr/bin/ffprobe"},
		{"custom_path", "/usr/bin/ffmpeg", "/custom/ffprobe", "/custom/ffprobe"},
		{"bare_ffmpeg", "ffmpeg", "", "ffprobe"},
		{"no_ffmpeg_in_path", "/opt/tools/converter", "", "ffprobe"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := newMockLocalMediaRepoForTranscoder()
			svc := NewTranscoderService(repo, tt.ffmpegPath, tt.ffprobePath, "/tmp/media")
			if svc.FFprobePath != tt.wantProbe {
				t.Errorf("FFprobePath = %q, want %q", svc.FFprobePath, tt.wantProbe)
			}
		})
	}
}

func TestMaxConcurrentTranscodes(t *testing.T) {
	if MaxConcurrentTranscodes != 4 {
		t.Errorf("MaxConcurrentTranscodes = %d, want 4", MaxConcurrentTranscodes)
	}
}

func TestScanCRLF_MoreCases(t *testing.T) {
	tests := []struct {
		name  string
		input []byte
		atEOF bool
		wantA int
		wantT string
	}{
		{"multiple_newlines", []byte("\nworld"), false, 1, ""},
		{"only_cr", []byte("\r"), false, 1, ""},
		{"only_lf", []byte("\n"), false, 1, ""},
		{"no_terminator_not_eof", []byte("hello"), false, 0, ""},
		{"crlf_at_start", []byte("\r\nworld"), false, 2, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			advance, token, _ := scanCRLF(tt.input, tt.atEOF)
			if advance != tt.wantA {
				t.Errorf("advance = %d, want %d", advance, tt.wantA)
			}
			got := ""
			if token != nil {
				got = string(token)
			}
			if got != tt.wantT {
				t.Errorf("token = %q, want %q", got, tt.wantT)
			}
		})
	}
}

func TestTranscoderService_ResumePendingTranscodes_NoItems(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	svc := NewTranscoderService(repo, "ffmpeg", "", "/tmp/media")

	// Should not panic with empty pending list
	svc.ResumePendingTranscodes()
}

// --- Additional TranscoderService tests ---

func TestNewTranscoderService_MediaPath(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	svc := NewTranscoderService(repo, "ffmpeg", "", "/custom/media")

	if svc.mediaPath != "/custom/media" {
		t.Errorf("mediaPath = %q, want %q", svc.mediaPath, "/custom/media")
	}
}

func TestNewTranscoderService_FFmpegPath(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	svc := NewTranscoderService(repo, "/usr/local/bin/ffmpeg", "", "/tmp/media")

	if svc.ffmpegPath != "/usr/local/bin/ffmpeg" {
		t.Errorf("ffmpegPath = %q, want %q", svc.ffmpegPath, "/usr/local/bin/ffmpeg")
	}
}

func TestTranscoderService_ResumePendingTranscodes_WithPendingItems(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	repo.media[1] = &model.LocalMedia{
		ID:               1,
		Status:           "pending",
		OriginalFilename: "video1.mp4",
		FilePath:         "/tmp/video1.mp4",
	}
	repo.media[2] = &model.LocalMedia{
		ID:               2,
		Status:           "processing",
		OriginalFilename: "video2.mp4",
		FilePath:         "/tmp/video2.mp4",
	}
	repo.media[3] = &model.LocalMedia{
		ID:               3,
		Status:           "completed",
		OriginalFilename: "video3.mp4",
		FilePath:         "/tmp/video3.mp4",
	}

	svc := NewTranscoderService(repo, "nonexistent-ffmpeg-binary", "", "/tmp/media")

	// Should attempt to resume pending/processing items (1 and 2)
	// Won't actually succeed since ffmpeg doesn't exist, but should not panic
	svc.ResumePendingTranscodes()
}

func TestScanCRLF_EmptyNotEOF(t *testing.T) {
	advance, token, _ := scanCRLF([]byte{}, false)
	if advance != 0 {
		t.Errorf("advance = %d, want 0", advance)
	}
	if token != nil {
		t.Errorf("token should be nil")
	}
}

func TestScanCRLF_LongLine(t *testing.T) {
	input := make([]byte, 1024)
	for i := range input {
		input[i] = 'x'
	}
	input = append(input, '\n')

	advance, token, _ := scanCRLF(input, false)
	if advance != 1025 {
		t.Errorf("advance = %d, want 1025", advance)
	}
	if len(token) != 1024 {
		t.Errorf("token len = %d, want 1024", len(token))
	}
}

func TestTimeRegex_NoMatch(t *testing.T) {
	tests := []string{
		"",
		"no time here",
		"time=invalid",
		"time=12:34",
		"Progress: 50%",
	}

	for _, line := range tests {
		matches := timeRegex.FindStringSubmatch(line)
		if len(matches) > 0 {
			t.Errorf("expected no match for %q, got %v", line, matches)
		}
	}
}

func TestNewTranscoderService_FFprobePathNoReplacement(t *testing.T) {
	// When ffmpegPath doesn't contain "ffmpeg", ffprobePath falls back to "ffprobe"
	repo := newMockLocalMediaRepoForTranscoder()
	svc := NewTranscoderService(repo, "/opt/my-encoder", "", "/tmp/media")

	if svc.FFprobePath != "ffprobe" {
		t.Errorf("FFprobePath = %q, want %q", svc.FFprobePath, "ffprobe")
	}
}

func TestTranscoderService_MockRepoUpdateStatus(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	repo.Create(&model.LocalMedia{
		OriginalFilename: "test.mp4",
		Status:           "pending",
	})

	err := repo.UpdateStatus(1, "processing", 50, "")
	if err != nil {
		t.Fatalf("UpdateStatus error: %v", err)
	}

	media, _ := repo.FindByID(1)
	if media.Status != "processing" {
		t.Errorf("status = %q, want processing", media.Status)
	}
	if media.Progress != 50 {
		t.Errorf("progress = %d, want 50", media.Progress)
	}
}

func TestTranscoderService_MockRepoFindPendingTranscodes(t *testing.T) {
	repo := newMockLocalMediaRepoForTranscoder()
	repo.media[1] = &model.LocalMedia{ID: 1, Status: "pending"}
	repo.media[2] = &model.LocalMedia{ID: 2, Status: "completed"}
	repo.media[3] = &model.LocalMedia{ID: 3, Status: "processing"}

	pending, err := repo.FindPendingTranscodes()
	if err != nil {
		t.Fatalf("FindPendingTranscodes error: %v", err)
	}
	if len(pending) != 2 {
		t.Errorf("pending count = %d, want 2 (pending + processing)", len(pending))
	}
}
