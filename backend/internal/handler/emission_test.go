package handler

import (
	"fmt"
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupEmissionHandler() (*EmissionHandler, *mockEmissionRepoH, *mockStreamRepoH) {
	emissionRepo := newMockEmissionRepoH()
	streamRepo := newMockStreamRepoH()
	svc := service.NewEmissionService(emissionRepo, streamRepo, "/usr/bin/ffmpeg", "/tmp/media")
	handler := NewEmissionHandler(svc)
	return handler, emissionRepo, streamRepo
}

func TestEmissionHandler_Status_NoEmission(t *testing.T) {
	h, _, _ := setupEmissionHandler()

	app := testApp()
	app.Get("/api/admin/channels/:id/emission/status", h.Status)

	result, status := makeRequest(app, "GET", "/api/admin/channels/1/emission/status", "")
	if status != 200 {
		t.Errorf("Status() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Status() should return success=true for no emission")
	}
}

func TestEmissionHandler_Status_WithEmission(t *testing.T) {
	h, emissionRepo, _ := setupEmissionHandler()
	emissionRepo.Create(&model.Emission{ChannelID: 1, Status: "stopped"})

	app := testApp()
	app.Get("/api/admin/channels/:id/emission/status", h.Status)

	result, status := makeRequest(app, "GET", "/api/admin/channels/1/emission/status", "")
	if status != 200 {
		t.Errorf("Status() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Status() should return success=true")
	}
}

func TestEmissionHandler_Status_InvalidID(t *testing.T) {
	h, _, _ := setupEmissionHandler()

	app := testApp()
	app.Get("/api/admin/channels/:id/emission/status", h.Status)

	result, status := makeRequest(app, "GET", "/api/admin/channels/abc/emission/status", "")
	if status != 400 {
		t.Errorf("Status() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Status() should return success=false for invalid ID")
	}
}

func TestEmissionHandler_Start_InvalidID(t *testing.T) {
	h, _, _ := setupEmissionHandler()

	app := testApp()
	app.Post("/api/admin/channels/:id/emission/start", h.Start)

	result, status := makeRequest(app, "POST", "/api/admin/channels/abc/emission/start", "")
	if status != 400 {
		t.Errorf("Start() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Start() should return success=false for invalid ID")
	}
}

func TestEmissionHandler_Start_NoPlaylist(t *testing.T) {
	h, _, _ := setupEmissionHandler()

	app := testApp()
	app.Post("/api/admin/channels/:id/emission/start", h.Start)

	// This will fail because the playlist file doesn't exist in /tmp/media
	result, status := makeRequest(app, "POST", "/api/admin/channels/999/emission/start", "")
	if status != 400 {
		t.Errorf("Start() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Start() should return success=false when no playlist exists")
	}
}

func TestEmissionHandler_Stop_InvalidID(t *testing.T) {
	h, _, _ := setupEmissionHandler()

	app := testApp()
	app.Post("/api/admin/channels/:id/emission/stop", h.Stop)

	result, status := makeRequest(app, "POST", "/api/admin/channels/abc/emission/stop", "")
	if status != 400 {
		t.Errorf("Stop() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Stop() should return success=false for invalid ID")
	}
}

func TestEmissionHandler_Stop_NoActiveEmission(t *testing.T) {
	h, _, _ := setupEmissionHandler()

	app := testApp()
	app.Post("/api/admin/channels/:id/emission/stop", h.Stop)

	result, status := makeRequest(app, "POST", "/api/admin/channels/1/emission/stop", "")
	if status != 200 {
		t.Errorf("Stop() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Stop() should return success=true")
	}
}

func TestEmissionHandler_LiveChannels_Empty(t *testing.T) {
	h, _, _ := setupEmissionHandler()

	app := testApp()
	app.Get("/api/emissions/live", h.LiveChannels)

	result, status := makeRequest(app, "GET", "/api/emissions/live", "")
	if status != 200 {
		t.Errorf("LiveChannels() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("LiveChannels() should return success=true")
	}
}

func TestEmissionHandler_LiveChannels_WithRunning(t *testing.T) {
	h, emissionRepo, _ := setupEmissionHandler()
	emissionRepo.Create(&model.Emission{ChannelID: 1, Status: "running"})
	emissionRepo.Create(&model.Emission{ChannelID: 2, Status: "stopped"})

	app := testApp()
	app.Get("/api/emissions/live", h.LiveChannels)

	result, status := makeRequest(app, "GET", "/api/emissions/live", "")
	if status != 200 {
		t.Errorf("LiveChannels() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("LiveChannels() should return success=true")
	}
}

func TestEmissionHandler_NewEmissionHandler(t *testing.T) {
	emissionRepo := newMockEmissionRepoH()
	streamRepo := newMockStreamRepoH()
	svc := service.NewEmissionService(emissionRepo, streamRepo, "/usr/bin/ffmpeg", "/tmp/media")
	handler := NewEmissionHandler(svc)
	if handler == nil {
		t.Error("NewEmissionHandler should not return nil")
	}
}

// Test that the emission service GetStatus returns the correct status for a running emission
func TestEmissionHandler_Status_RunningButNoProcess(t *testing.T) {
	h, emissionRepo, _ := setupEmissionHandler()
	// Emission marked as running in DB but no actual process
	emissionRepo.Create(&model.Emission{ChannelID: 5, Status: "running", PID: 12345})

	app := testApp()
	app.Get("/api/admin/channels/:id/emission/status", h.Status)

	result, status := makeRequest(app, "GET", fmt.Sprintf("/api/admin/channels/%d/emission/status", 5), "")
	if status != 200 {
		t.Errorf("Status() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Status() should return success=true")
	}
	// The service should detect that there's no process and mark it as stopped
	data, ok := result.Data.(map[string]interface{})
	if ok {
		if data["is_live"] == true {
			t.Error("Status() should report is_live=false when process is not running")
		}
	}
}

// Test the emission model
func TestEmissionModel(t *testing.T) {
	e := &model.Emission{
		ChannelID: 1,
		Status:    "stopped",
	}
	if e.ChannelID != 1 {
		t.Errorf("expected ChannelID 1, got %d", e.ChannelID)
	}
	if e.Status != "stopped" {
		t.Errorf("expected Status 'stopped', got %q", e.Status)
	}
}
