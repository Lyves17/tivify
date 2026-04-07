package service

import (
	"testing"

	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock LocalMedia Repository ---

type mockLocalMediaRepo struct {
	media  map[uint]*model.LocalMedia
	nextID uint
}

func newMockLocalMediaRepo() *mockLocalMediaRepo {
	return &mockLocalMediaRepo{media: make(map[uint]*model.LocalMedia), nextID: 1}
}

func (m *mockLocalMediaRepo) Create(media *model.LocalMedia) error {
	media.ID = m.nextID
	m.nextID++
	m.media[media.ID] = media
	return nil
}

func (m *mockLocalMediaRepo) FindByID(id uint) (*model.LocalMedia, error) {
	media, ok := m.media[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return media, nil
}

func (m *mockLocalMediaRepo) List(page, perPage int) ([]model.LocalMedia, int64, error) {
	var result []model.LocalMedia
	for _, media := range m.media {
		result = append(result, *media)
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

func (m *mockLocalMediaRepo) Update(media *model.LocalMedia) error {
	m.media[media.ID] = media
	return nil
}

func (m *mockLocalMediaRepo) UpdateStatus(id uint, status string, progress int, errorMsg string) error {
	if media, ok := m.media[id]; ok {
		media.Status = status
		media.Progress = progress
		media.ErrorMessage = errorMsg
	}
	return nil
}

func (m *mockLocalMediaRepo) Delete(id uint) error {
	if _, ok := m.media[id]; !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.media, id)
	return nil
}

func (m *mockLocalMediaRepo) FindPendingTranscodes() ([]model.LocalMedia, error) {
	var result []model.LocalMedia
	for _, media := range m.media {
		if media.Status == "pending" || media.Status == "processing" {
			result = append(result, *media)
		}
	}
	return result, nil
}

func (m *mockLocalMediaRepo) ListRecent(limit int) ([]model.LocalMedia, error) {
	var result []model.LocalMedia
	for _, media := range m.media {
		result = append(result, *media)
		if len(result) >= limit {
			break
		}
	}
	return result, nil
}

// --- Tests ---

func TestLocalMediaService_GetByID_Success(t *testing.T) {
	repo := newMockLocalMediaRepo()
	svc := &LocalMediaService{repo: repo, mediaPath: "/tmp/media"}

	repo.media[1] = &model.LocalMedia{
		ID:               1,
		OriginalFilename: "video.mp4",
		FilePath:         "/tmp/media/uploads/abc.mp4",
		Status:           "completed",
		MimeType:         "video/mp4",
	}

	resp, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.OriginalFilename != "video.mp4" {
		t.Errorf("OriginalFilename = %q, want %q", resp.OriginalFilename, "video.mp4")
	}
	if resp.Status != "completed" {
		t.Errorf("Status = %q, want %q", resp.Status, "completed")
	}
	if resp.MimeType != "video/mp4" {
		t.Errorf("MimeType = %q, want %q", resp.MimeType, "video/mp4")
	}
}

func TestLocalMediaService_GetByID_NotFound(t *testing.T) {
	repo := newMockLocalMediaRepo()
	svc := &LocalMediaService{repo: repo, mediaPath: "/tmp/media"}

	_, err := svc.GetByID(999)
	if err == nil {
		t.Error("expected error for missing media")
	}
}

func TestLocalMediaService_List_Success(t *testing.T) {
	repo := newMockLocalMediaRepo()
	svc := &LocalMediaService{repo: repo, mediaPath: "/tmp/media"}

	repo.media[1] = &model.LocalMedia{ID: 1, OriginalFilename: "video1.mp4", Status: "completed"}
	repo.media[2] = &model.LocalMedia{ID: 2, OriginalFilename: "video2.mkv", Status: "pending"}
	repo.media[3] = &model.LocalMedia{ID: 3, OriginalFilename: "video3.avi", Status: "processing"}

	responses, total, err := svc.List(1, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3", total)
	}
	if len(responses) != 3 {
		t.Errorf("len(responses) = %d, want 3", len(responses))
	}
}

func TestLocalMediaService_List_Empty(t *testing.T) {
	repo := newMockLocalMediaRepo()
	svc := &LocalMediaService{repo: repo, mediaPath: "/tmp/media"}

	responses, total, err := svc.List(1, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
	if responses != nil && len(responses) != 0 {
		t.Errorf("expected empty responses, got %d", len(responses))
	}
}

func TestLocalMediaService_List_Pagination(t *testing.T) {
	repo := newMockLocalMediaRepo()
	svc := &LocalMediaService{repo: repo, mediaPath: "/tmp/media"}

	for i := uint(1); i <= 5; i++ {
		repo.media[i] = &model.LocalMedia{ID: i, OriginalFilename: "video.mp4"}
	}
	repo.nextID = 6

	responses, total, err := svc.List(1, 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 5 {
		t.Errorf("total = %d, want 5", total)
	}
	if len(responses) != 2 {
		t.Errorf("len(responses) = %d, want 2 (page 1, perPage 2)", len(responses))
	}
}

func TestLocalMediaService_Delete_Success(t *testing.T) {
	repo := newMockLocalMediaRepo()
	svc := &LocalMediaService{repo: repo, mediaPath: "/tmp/media"}

	repo.media[1] = &model.LocalMedia{
		ID:            1,
		FilePath:      "/tmp/nonexistent/file.mp4", // file won't exist, that's fine
		ThumbnailPath: "",
	}

	err := svc.Delete(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := repo.media[1]; ok {
		t.Error("media should have been deleted from repo")
	}
}

func TestLocalMediaService_Delete_NotFound(t *testing.T) {
	repo := newMockLocalMediaRepo()
	svc := &LocalMediaService{repo: repo, mediaPath: "/tmp/media"}

	err := svc.Delete(999)
	if err == nil {
		t.Error("expected error for missing media")
	}
}

func TestLocalMediaService_Delete_WithThumbnail(t *testing.T) {
	repo := newMockLocalMediaRepo()
	svc := &LocalMediaService{repo: repo, mediaPath: "/tmp/media"}

	repo.media[1] = &model.LocalMedia{
		ID:            1,
		FilePath:      "/tmp/nonexistent/file.mp4",
		ThumbnailPath: "/media/thumbnails/thumb.jpg",
	}

	// Should not panic even if files don't exist
	err := svc.Delete(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLocalMediaService_ToLocalMediaResponse(t *testing.T) {
	media := &model.LocalMedia{
		ID:               1,
		OriginalFilename: "test.mp4",
		FilePath:         "/tmp/test.mp4",
		HLSPath:          "/media/local/1/index.m3u8",
		FileSize:         1024000,
		Duration:         120.5,
		Resolution:       "1080p",
		MimeType:         "video/mp4",
		Status:           "completed",
		Progress:         100,
		ErrorMessage:     "",
		ThumbnailPath:    "/media/thumbnails/abc.jpg",
	}

	resp := toLocalMediaResponse(media)
	if resp.ID != 1 {
		t.Errorf("ID = %d, want 1", resp.ID)
	}
	if resp.OriginalFilename != "test.mp4" {
		t.Errorf("OriginalFilename = %q, want %q", resp.OriginalFilename, "test.mp4")
	}
	if resp.HLSPath != "/media/local/1/index.m3u8" {
		t.Errorf("HLSPath = %q, want %q", resp.HLSPath, "/media/local/1/index.m3u8")
	}
	if resp.FileSize != 1024000 {
		t.Errorf("FileSize = %d, want 1024000", resp.FileSize)
	}
	if resp.Duration != 120.5 {
		t.Errorf("Duration = %f, want 120.5", resp.Duration)
	}
	if resp.Resolution != "1080p" {
		t.Errorf("Resolution = %q, want %q", resp.Resolution, "1080p")
	}
	if resp.Status != "completed" {
		t.Errorf("Status = %q, want %q", resp.Status, "completed")
	}
	if resp.Progress != 100 {
		t.Errorf("Progress = %d, want 100", resp.Progress)
	}
}

func TestIsValidVideoMimeType(t *testing.T) {
	tests := []struct {
		name     string
		mimeType string
		want     bool
	}{
		{"mp4", "video/mp4", true},
		{"matroska", "video/x-matroska", true},
		{"avi", "video/x-msvideo", true},
		{"webm", "video/webm", true},
		{"quicktime", "video/quicktime", true},
		{"flv", "video/x-flv", true},
		{"mp2t", "video/mp2t", true},
		{"m4v", "video/x-m4v", true},
		{"wmv", "video/x-ms-wmv", true},
		{"octet-stream", "application/octet-stream", true},
		{"mp4_with_charset", "video/mp4; charset=utf-8", true},
		{"text_html", "text/html", false},
		{"image_png", "image/png", false},
		{"audio_mp3", "audio/mpeg", false},
		{"empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidVideoMimeType(tt.mimeType)
			if got != tt.want {
				t.Errorf("isValidVideoMimeType(%q) = %v, want %v", tt.mimeType, got, tt.want)
			}
		})
	}
}

func TestSafeResolvePath(t *testing.T) {
	svc := &LocalMediaService{mediaPath: "/tmp/media"}

	tests := []struct {
		name     string
		base     string
		relative string
		wantOK   bool
	}{
		{"normal_path", "/tmp/media", "thumbnails/abc.jpg", true},
		{"nested_path", "/tmp/media", "uploads/sub/file.mp4", true},
		{"traversal_attack", "/tmp/media", "../../etc/passwd", false},
		{"dot_dot", "/tmp/media", "../secret", false},
		{"current_dir", "/tmp/media", "./file.mp4", true},
		{"absolute_within", "/tmp/media", "local/1/index.m3u8", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.SafeResolvePath(tt.base, tt.relative)
			if tt.wantOK && result == "" {
				t.Errorf("SafeResolvePath(%q, %q) returned empty, expected valid path", tt.base, tt.relative)
			}
			if !tt.wantOK && result != "" {
				t.Errorf("SafeResolvePath(%q, %q) = %q, expected empty (path traversal blocked)", tt.base, tt.relative, result)
			}
		})
	}
}

func TestAllowedVideoExtensions(t *testing.T) {
	allowed := []string{".mp4", ".mkv", ".avi", ".webm", ".mov", ".flv", ".ts", ".m4v", ".wmv"}
	notAllowed := []string{".txt", ".jpg", ".png", ".html", ".exe", ".doc", ".mp3"}

	for _, ext := range allowed {
		if !allowedVideoExtensions[ext] {
			t.Errorf("extension %q should be allowed", ext)
		}
	}
	for _, ext := range notAllowed {
		if allowedVideoExtensions[ext] {
			t.Errorf("extension %q should not be allowed", ext)
		}
	}
}
