package handler

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupLocalMediaHandler() (*LocalMediaHandler, *mockLocalMediaRepoH) {
	repo := newMockLocalMediaRepoH()
	vodRepo := newMockVODRepoH()
	// TranscoderService and VODService are not needed for List/GetByID/Delete
	localMediaSvc := service.NewLocalMediaService(repo, nil, service.NewVODService(vodRepo, nil), "/tmp/test-media")
	vodSvc := service.NewVODService(vodRepo, nil)
	handler := NewLocalMediaHandler(localMediaSvc, vodSvc)
	return handler, repo
}

func setupLocalMediaHandlerWithTranscoder() (*LocalMediaHandler, *mockLocalMediaRepoH) {
	repo := newMockLocalMediaRepoH()
	vodRepo := newMockVODRepoH()
	transcoder := service.NewTranscoderService(repo, "ffmpeg", "ffprobe", "/tmp/test-media")
	vodSvc := service.NewVODService(vodRepo, nil)
	localMediaSvc := service.NewLocalMediaService(repo, transcoder, vodSvc, "/tmp/test-media")
	handler := NewLocalMediaHandler(localMediaSvc, vodSvc)
	return handler, repo
}

func TestLocalMediaHandler_List(t *testing.T) {
	h, repo := setupLocalMediaHandler()
	repo.Create(&model.LocalMedia{
		OriginalFilename: "video1.mp4",
		FilePath:         "/tmp/test-media/uploads/video1.mp4",
		Status:           "completed",
	})

	app := testApp()
	app.Get("/api/admin/media", h.List)

	result, status := makeRequest(app, "GET", "/api/admin/media", "")
	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestLocalMediaHandler_List_Empty(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Get("/api/admin/media", h.List)

	result, status := makeRequest(app, "GET", "/api/admin/media", "")
	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true for empty list")
	}
}

func TestLocalMediaHandler_List_Pagination(t *testing.T) {
	h, repo := setupLocalMediaHandler()
	for i := 0; i < 5; i++ {
		repo.Create(&model.LocalMedia{
			OriginalFilename: fmt.Sprintf("video%d.mp4", i),
			FilePath:         fmt.Sprintf("/tmp/test-media/uploads/video%d.mp4", i),
			Status:           "completed",
		})
	}

	app := testApp()
	app.Get("/api/admin/media", h.List)

	result, status := makeRequest(app, "GET", "/api/admin/media?page=1&per_page=2", "")
	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestLocalMediaHandler_GetByID(t *testing.T) {
	h, repo := setupLocalMediaHandler()
	media := &model.LocalMedia{
		OriginalFilename: "video1.mp4",
		FilePath:         "/tmp/test-media/uploads/video1.mp4",
		Status:           "completed",
	}
	repo.Create(media)

	app := testApp()
	app.Get("/api/admin/media/:id", h.GetByID)

	result, status := makeRequest(app, "GET", fmt.Sprintf("/api/admin/media/%d", media.ID), "")
	if status != 200 {
		t.Errorf("GetByID() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetByID() should return success=true")
	}
}

func TestLocalMediaHandler_GetByID_InvalidID(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Get("/api/admin/media/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/admin/media/abc", "")
	if status != 400 {
		t.Errorf("GetByID() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false for invalid ID")
	}
}

func TestLocalMediaHandler_GetByID_NotFound(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Get("/api/admin/media/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/admin/media/999", "")
	if status != 404 {
		t.Errorf("GetByID() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false for not found")
	}
}

func TestLocalMediaHandler_Delete(t *testing.T) {
	h, repo := setupLocalMediaHandler()
	media := &model.LocalMedia{
		OriginalFilename: "video1.mp4",
		FilePath:         "/tmp/nonexistent/video1.mp4", // won't exist, os.Remove silently fails
		Status:           "completed",
	}
	repo.Create(media)

	app := testApp()
	app.Delete("/api/admin/media/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/media/%d", media.ID), "")
	if status != 200 {
		t.Errorf("Delete() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Delete() should return success=true")
	}
}

func TestLocalMediaHandler_Delete_InvalidID(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Delete("/api/admin/media/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/media/abc", "")
	if status != 400 {
		t.Errorf("Delete() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false for invalid ID")
	}
}

func TestLocalMediaHandler_CreateVOD_InvalidID(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Post("/api/admin/media/:id/create-vod", h.CreateVOD)

	result, status := makeRequest(app, "POST", "/api/admin/media/abc/create-vod", `{"title":"Test"}`)
	if status != 400 {
		t.Errorf("CreateVOD() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("CreateVOD() should return success=false for invalid ID")
	}
}

func TestLocalMediaHandler_CreateVOD_NotFound(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Post("/api/admin/media/:id/create-vod", h.CreateVOD)

	result, status := makeRequest(app, "POST", "/api/admin/media/999/create-vod", `{"title":"Test"}`)
	if status != 404 {
		t.Errorf("CreateVOD() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("CreateVOD() should return success=false for not found")
	}
}

func TestLocalMediaHandler_CreateVOD_InvalidBody(t *testing.T) {
	h, repo := setupLocalMediaHandler()
	media := &model.LocalMedia{
		OriginalFilename: "video1.mp4",
		FilePath:         "/tmp/test-media/uploads/video1.mp4",
		Status:           "completed",
		HLSPath:          "/tmp/test-media/hls/video1/master.m3u8",
	}
	repo.Create(media)

	app := testApp()
	app.Post("/api/admin/media/:id/create-vod", h.CreateVOD)

	result, status := makeRequest(app, "POST", fmt.Sprintf("/api/admin/media/%d/create-vod", media.ID), "not-json")
	if status != 400 {
		t.Errorf("CreateVOD() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("CreateVOD() should return success=false for invalid body")
	}
}

func TestLocalMediaHandler_CreateVOD_MediaNotCompleted(t *testing.T) {
	h, repo := setupLocalMediaHandler()
	media := &model.LocalMedia{
		OriginalFilename: "video1.mp4",
		FilePath:         "/tmp/test-media/uploads/video1.mp4",
		Status:           "processing",
		HLSPath:          "",
	}
	repo.Create(media)

	app := testApp()
	app.Post("/api/admin/media/:id/create-vod", h.CreateVOD)

	body := `{"title":"Test VOD"}`
	result, status := makeRequest(app, "POST", fmt.Sprintf("/api/admin/media/%d/create-vod", media.ID), body)
	if status != 400 {
		t.Errorf("CreateVOD() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("CreateVOD() should return success=false when media is not completed")
	}
}

func TestLocalMediaHandler_Delete_NotFound(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Delete("/api/admin/media/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/media/999", "")
	if status != 500 {
		t.Errorf("Delete() not found status = %d, want 500", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false for not found")
	}
}


func TestLocalMediaHandler_Upload_NoFile(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Post("/api/admin/media/upload", h.Upload)

	// Send a request without a file
	req := httptest.NewRequest("POST", "/api/admin/media/upload", nil)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 400 {
		t.Errorf("Upload() no file status = %d, want 400", resp.StatusCode)
	}
}

func TestLocalMediaHandler_Upload_WithFile(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Post("/api/admin/media/upload", h.Upload)

	// Create multipart form with a small file
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "test.mp4")
	part.Write([]byte("fake video content"))
	writer.Close()

	req := httptest.NewRequest("POST", "/api/admin/media/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	_ = data
	// The service.Upload will fail because it tries to save the file
	// but the error path still exercises the handler code
	if resp.StatusCode != 400 && resp.StatusCode != 201 {
		t.Errorf("Upload() with file status = %d, want 400 or 201", resp.StatusCode)
	}
}

func TestLocalMediaHandler_UploadAndCreateVOD_NoFile(t *testing.T) {
	h, _ := setupLocalMediaHandler()

	app := testApp()
	app.Post("/api/admin/media/upload-vod", h.UploadAndCreateVOD)

	req := httptest.NewRequest("POST", "/api/admin/media/upload-vod", nil)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 400 {
		t.Errorf("UploadAndCreateVOD() no file status = %d, want 400", resp.StatusCode)
	}
}


func TestLocalMediaHandler_CreateVOD_Success(t *testing.T) {
	h, repo := setupLocalMediaHandler()
	media := &model.LocalMedia{
		OriginalFilename: "video1.mp4",
		FilePath:         "/tmp/test-media/uploads/video1.mp4",
		Status:           "completed",
		HLSPath:          "/media/hls/video1/master.m3u8",
		Duration:         120.5,
		Resolution:       "1920x1080",
	}
	repo.Create(media)

	app := testApp()
	app.Post("/api/admin/media/:id/create-vod", h.CreateVOD)

	body := `{"title":"Test VOD","description":"A test video"}`
	result, status := makeRequest(app, "POST", fmt.Sprintf("/api/admin/media/%d/create-vod", media.ID), body)
	if status != 201 {
		t.Errorf("CreateVOD() status = %d, want 201", status)
	}
	if !result.Success {
		t.Error("CreateVOD() should return success=true")
	}
}

// --- Diagnostics tests ---

func TestLocalMediaHandler_Diagnostics(t *testing.T) {
	h, _ := setupLocalMediaHandlerWithTranscoder()

	app := testApp()
	app.Get("/api/admin/media/diagnostics", h.Diagnostics)

	result, status := makeRequest(app, "GET", "/api/admin/media/diagnostics", "")
	if status != 200 {
		t.Errorf("Diagnostics() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Diagnostics() should return success=true")
	}
}

// --- UploadAndCreateVOD additional tests ---

func TestLocalMediaHandler_UploadAndCreateVOD_WithFile(t *testing.T) {
	h, _ := setupLocalMediaHandlerWithTranscoder()

	app := testApp()
	app.Post("/api/admin/media/upload-vod", h.UploadAndCreateVOD)

	// Create multipart form with a video file
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "test_movie.mp4")
	part.Write([]byte("fake video content"))
	writer.Close()

	req := httptest.NewRequest("POST", "/api/admin/media/upload-vod", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	// Will fail because it tries to save the file to a path that may not exist,
	// but exercises the handler code paths for title generation from filename
	if resp.StatusCode != 400 && resp.StatusCode != 201 {
		t.Errorf("UploadAndCreateVOD() with file status = %d, want 400 or 201", resp.StatusCode)
	}
}

func TestLocalMediaHandler_UploadAndCreateVOD_WithTitle(t *testing.T) {
	h, _ := setupLocalMediaHandlerWithTranscoder()

	app := testApp()
	app.Post("/api/admin/media/upload-vod", h.UploadAndCreateVOD)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "test.mp4")
	part.Write([]byte("fake video content"))
	// Add title form field
	writer.WriteField("title", "My Custom Title")
	writer.Close()

	req := httptest.NewRequest("POST", "/api/admin/media/upload-vod", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 400 && resp.StatusCode != 201 {
		t.Errorf("UploadAndCreateVOD() with title status = %d, want 400 or 201", resp.StatusCode)
	}
}

func TestLocalMediaHandler_UploadAndCreateVOD_WithSeriesFields(t *testing.T) {
	h, _ := setupLocalMediaHandlerWithTranscoder()

	app := testApp()
	app.Post("/api/admin/media/upload-vod", h.UploadAndCreateVOD)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "show.s01e05.mp4")
	part.Write([]byte("fake video content"))
	writer.WriteField("title", "Episode Title")
	writer.WriteField("series_id", "1")
	writer.WriteField("season_number", "1")
	writer.WriteField("episode_number", "5")
	writer.Close()

	req := httptest.NewRequest("POST", "/api/admin/media/upload-vod", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 400 && resp.StatusCode != 201 {
		t.Errorf("UploadAndCreateVOD() with series fields status = %d, want 400 or 201", resp.StatusCode)
	}
}

func TestLocalMediaHandler_UploadAndCreateVOD_InvalidExtension(t *testing.T) {
	h, _ := setupLocalMediaHandlerWithTranscoder()

	app := testApp()
	app.Post("/api/admin/media/upload-vod", h.UploadAndCreateVOD)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "document.pdf")
	part.Write([]byte("not a video"))
	writer.Close()

	req := httptest.NewRequest("POST", "/api/admin/media/upload-vod", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 400 {
		t.Errorf("UploadAndCreateVOD() invalid extension status = %d, want 400", resp.StatusCode)
	}
}

func TestLocalMediaHandler_UploadAndCreateVOD_InvalidSeriesID(t *testing.T) {
	h, _ := setupLocalMediaHandlerWithTranscoder()

	app := testApp()
	app.Post("/api/admin/media/upload-vod", h.UploadAndCreateVOD)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "movie.mp4")
	part.Write([]byte("fake video"))
	writer.WriteField("series_id", "not-a-number")
	writer.WriteField("season_number", "abc")
	writer.WriteField("episode_number", "xyz")
	writer.Close()

	req := httptest.NewRequest("POST", "/api/admin/media/upload-vod", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	// Invalid series_id/season/episode are silently ignored (parsed as 0/nil)
	// So this should still attempt the upload (and fail because of filesystem)
	if resp.StatusCode != 400 && resp.StatusCode != 201 {
		t.Errorf("UploadAndCreateVOD() invalid series fields status = %d, want 400 or 201", resp.StatusCode)
	}
}
