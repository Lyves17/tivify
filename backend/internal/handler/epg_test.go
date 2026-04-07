package handler

import (
	"fmt"
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupEPGHandler() (*EPGHandler, *mockEPGRepoH, *mockChannelRepoH) {
	epgRepo := newMockEPGRepoH()
	channelRepo := newMockChannelRepoH()
	// Add a default channel so Create can find it
	channelRepo.addChannel(&model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true})
	svc := service.NewEPGService(epgRepo, channelRepo)
	handler := NewEPGHandler(svc)
	return handler, epgRepo, channelRepo
}

func TestEPGHandler_List(t *testing.T) {
	h, _, _ := setupEPGHandler()

	app := testApp()
	app.Get("/api/admin/epg", h.List)

	result, status := makeRequest(app, "GET", "/api/admin/epg", "")
	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestEPGHandler_ListByChannel(t *testing.T) {
	h, _, _ := setupEPGHandler()

	app := testApp()
	app.Get("/api/epg", h.ListByChannel)

	result, status := makeRequest(app, "GET", "/api/epg?channel_id=1", "")
	if status != 200 {
		t.Errorf("ListByChannel() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListByChannel() should return success=true")
	}
}

func TestEPGHandler_ListByChannel_MissingChannelID(t *testing.T) {
	h, _, _ := setupEPGHandler()

	app := testApp()
	app.Get("/api/epg", h.ListByChannel)

	result, status := makeRequest(app, "GET", "/api/epg", "")
	if status != 400 {
		t.Errorf("ListByChannel() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("ListByChannel() should return success=false when missing channel_id")
	}
}

func TestEPGHandler_GetByID(t *testing.T) {
	h, repo, _ := setupEPGHandler()
	entry := &model.EPGEntry{ChannelID: 1, Title: "Program 1"}
	repo.Create(entry)

	app := testApp()
	app.Get("/api/admin/epg/:id", h.GetByID)

	result, status := makeRequest(app, "GET", fmt.Sprintf("/api/admin/epg/%d", entry.ID), "")
	if status != 200 {
		t.Errorf("GetByID() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetByID() should return success=true")
	}
}

func TestEPGHandler_GetByID_NotFound(t *testing.T) {
	h, _, _ := setupEPGHandler()

	app := testApp()
	app.Get("/api/admin/epg/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/admin/epg/999", "")
	if status != 404 {
		t.Errorf("GetByID() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false")
	}
}

func TestEPGHandler_Create(t *testing.T) {
	h, _, _ := setupEPGHandler()

	app := testApp()
	app.Post("/api/admin/epg", h.Create)

	body := `{"channel_id":1,"title":"New Program","start_time":"2024-01-01T10:00:00Z","end_time":"2024-01-01T11:00:00Z"}`
	result, status := makeRequest(app, "POST", "/api/admin/epg", body)
	if status != 201 {
		t.Errorf("Create() status = %d, want 201", status)
	}
	if !result.Success {
		t.Error("Create() should return success=true")
	}
}

func TestEPGHandler_Create_InvalidBody(t *testing.T) {
	h, _, _ := setupEPGHandler()

	app := testApp()
	app.Post("/api/admin/epg", h.Create)

	result, status := makeRequest(app, "POST", "/api/admin/epg", "not-json")
	if status != 400 {
		t.Errorf("Create() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for invalid body")
	}
}

func TestEPGHandler_Delete(t *testing.T) {
	h, repo, _ := setupEPGHandler()
	entry := &model.EPGEntry{ChannelID: 1, Title: "Program 1"}
	repo.Create(entry)

	app := testApp()
	app.Delete("/api/admin/epg/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/epg/%d", entry.ID), "")
	if status != 200 {
		t.Errorf("Delete() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Delete() should return success=true")
	}
}

func TestEPGHandler_Update(t *testing.T) {
	h, repo, _ := setupEPGHandler()
	entry := &model.EPGEntry{ChannelID: 1, Title: "Program 1"}
	repo.Create(entry)

	app := testApp()
	app.Put("/api/admin/epg/:id", h.Update)

	body := `{"title":"Updated Program","channel_id":1}`
	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/epg/%d", entry.ID), body)
	if status != 200 {
		t.Errorf("Update() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Update() should return success=true")
	}
}

func TestEPGHandler_Update_InvalidID(t *testing.T) {
	h, _, _ := setupEPGHandler()
	app := testApp()
	app.Put("/api/admin/epg/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/epg/abc", `{"title":"test"}`)
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false")
	}
}

func TestEPGHandler_Update_InvalidBody(t *testing.T) {
	h, repo, _ := setupEPGHandler()
	entry := &model.EPGEntry{ChannelID: 1, Title: "Program 1"}
	repo.Create(entry)
	app := testApp()
	app.Put("/api/admin/epg/:id", h.Update)

	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/epg/%d", entry.ID), "not-json")
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false")
	}
}

func TestEPGHandler_GetByID_InvalidID(t *testing.T) {
	h, _, _ := setupEPGHandler()
	app := testApp()
	app.Get("/api/admin/epg/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/admin/epg/abc", "")
	if status != 400 {
		t.Errorf("GetByID() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false")
	}
}

func TestEPGHandler_Delete_InvalidID(t *testing.T) {
	h, _, _ := setupEPGHandler()
	app := testApp()
	app.Delete("/api/admin/epg/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/epg/abc", "")
	if status != 400 {
		t.Errorf("Delete() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false")
	}
}

func TestEPGHandler_ListByChannel_InvalidChannelID(t *testing.T) {
	h, _, _ := setupEPGHandler()
	app := testApp()
	app.Get("/api/epg", h.ListByChannel)

	result, status := makeRequest(app, "GET", "/api/epg?channel_id=abc", "")
	if status != 400 {
		t.Errorf("ListByChannel() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("ListByChannel() should return success=false")
	}
}
