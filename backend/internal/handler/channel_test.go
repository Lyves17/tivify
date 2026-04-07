package handler

import (
	"fmt"
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupChannelHandler() (*ChannelHandler, *mockChannelRepoH, *mockStreamRepoH) {
	channelRepo := newMockChannelRepoH()
	streamRepo := newMockStreamRepoH()
	svc := service.NewChannelService(channelRepo, streamRepo, nil)
	handler := NewChannelHandler(svc)
	return handler, channelRepo, streamRepo
}

func TestChannelHandler_List(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	repo.addChannel(&model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true})

	app := testApp()
	app.Get("/api/admin/channels", h.List)

	result, status := makeRequest(app, "GET", "/api/admin/channels", "")
	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestChannelHandler_ListActive(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	repo.addChannel(&model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true})

	app := testApp()
	app.Get("/api/channels", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/channels", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true")
	}
}

func TestChannelHandler_GetByID(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	ch := &model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true}
	repo.addChannel(ch)

	app := testApp()
	app.Get("/api/channels/:id", h.GetByID)

	result, status := makeRequest(app, "GET", fmt.Sprintf("/api/channels/%d", ch.ID), "")
	if status != 200 {
		t.Errorf("GetByID() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetByID() should return success=true")
	}
}

func TestChannelHandler_GetByID_InvalidID(t *testing.T) {
	h, _, _ := setupChannelHandler()

	app := testApp()
	app.Get("/api/channels/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/channels/abc", "")
	if status != 400 {
		t.Errorf("GetByID() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false for invalid ID")
	}
}

func TestChannelHandler_GetByID_NotFound(t *testing.T) {
	h, _, _ := setupChannelHandler()

	app := testApp()
	app.Get("/api/channels/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/channels/999", "")
	if status != 404 {
		t.Errorf("GetByID() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false for not found")
	}
}

func TestChannelHandler_Update(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	ch := &model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true}
	repo.addChannel(ch)

	app := testApp()
	app.Put("/api/admin/channels/:id", h.Update)

	body := `{"name":"Canal Updated"}`
	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/channels/%d", ch.ID), body)
	if status != 200 {
		t.Errorf("Update() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Update() should return success=true")
	}
}

func TestChannelHandler_Delete(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	ch := &model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true}
	repo.addChannel(ch)

	app := testApp()
	app.Delete("/api/admin/channels/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/channels/%d", ch.ID), "")
	if status != 200 {
		t.Errorf("Delete() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Delete() should return success=true")
	}
}

func TestChannelHandler_AddStream(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	ch := &model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true}
	repo.addChannel(ch)

	app := testApp()
	app.Post("/api/admin/channels/:id/streams", h.AddStream)

	body := `{"url":"http://example.com/stream.m3u8","type":"hls"}`
	result, status := makeRequest(app, "POST", fmt.Sprintf("/api/admin/channels/%d/streams", ch.ID), body)
	if status != 201 {
		t.Errorf("AddStream() status = %d, want 201", status)
	}
	if !result.Success {
		t.Error("AddStream() should return success=true")
	}
}

func TestChannelHandler_AddStream_InvalidBody(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	ch := &model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true}
	repo.addChannel(ch)

	app := testApp()
	app.Post("/api/admin/channels/:id/streams", h.AddStream)

	result, status := makeRequest(app, "POST", fmt.Sprintf("/api/admin/channels/%d/streams", ch.ID), "not-json")
	if status != 400 {
		t.Errorf("AddStream() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("AddStream() should return success=false for invalid body")
	}
}

func TestChannelHandler_UpdateStream(t *testing.T) {
	h, repo, streamRepo := setupChannelHandler()
	ch := &model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true}
	repo.addChannel(ch)
	stream := &model.Stream{ChannelID: ch.ID, URL: "http://example.com/old.m3u8", StreamFormat: "hls"}
	streamRepo.Create(stream)

	app := testApp()
	app.Put("/api/admin/streams/:streamId", h.UpdateStream)

	body := `{"url":"http://example.com/new.m3u8"}`
	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/streams/%d", stream.ID), body)
	if status != 200 {
		t.Errorf("UpdateStream() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("UpdateStream() should return success=true")
	}
}

func TestChannelHandler_DeleteStream(t *testing.T) {
	h, repo, streamRepo := setupChannelHandler()
	ch := &model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true}
	repo.addChannel(ch)
	stream := &model.Stream{ChannelID: ch.ID, URL: "http://example.com/stream.m3u8", StreamFormat: "hls"}
	streamRepo.Create(stream)

	app := testApp()
	app.Delete("/api/admin/streams/:streamId", h.DeleteStream)

	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/streams/%d", stream.ID), "")
	if status != 200 {
		t.Errorf("DeleteStream() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("DeleteStream() should return success=true")
	}
}

func TestChannelHandler_Create_InvalidBody(t *testing.T) {
	h, _, _ := setupChannelHandler()
	app := testApp()
	app.Post("/api/admin/channels", h.Create)

	result, status := makeRequest(app, "POST", "/api/admin/channels", "not-json")
	if status != 400 {
		t.Errorf("Create() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false")
	}
}

func TestChannelHandler_Create_EmptyName(t *testing.T) {
	h, _, _ := setupChannelHandler()
	app := testApp()
	app.Post("/api/admin/channels", h.Create)

	// Empty name triggers validation error before DB transaction
	body := `{"name":"","slug":"canal-nuevo"}`
	result, status := makeRequest(app, "POST", "/api/admin/channels", body)
	if status != 400 {
		t.Errorf("Create() status = %d, want 400 for empty name", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for empty name")
	}
}

func TestChannelHandler_Update_InvalidBody(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	ch := &model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true}
	repo.addChannel(ch)
	app := testApp()
	app.Put("/api/admin/channels/:id", h.Update)

	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/channels/%d", ch.ID), "not-json")
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false")
	}
}

func TestChannelHandler_Update_InvalidID(t *testing.T) {
	h, _, _ := setupChannelHandler()
	app := testApp()
	app.Put("/api/admin/channels/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/channels/abc", `{"name":"test"}`)
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false")
	}
}

func TestChannelHandler_Delete_InvalidID(t *testing.T) {
	h, _, _ := setupChannelHandler()
	app := testApp()
	app.Delete("/api/admin/channels/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/channels/abc", "")
	if status != 400 {
		t.Errorf("Delete() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false")
	}
}

func TestChannelHandler_AddStream_InvalidID(t *testing.T) {
	h, _, _ := setupChannelHandler()
	app := testApp()
	app.Post("/api/admin/channels/:id/streams", h.AddStream)

	result, status := makeRequest(app, "POST", "/api/admin/channels/abc/streams", `{"url":"http://example.com/s.m3u8","type":"hls"}`)
	if status != 400 {
		t.Errorf("AddStream() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("AddStream() should return success=false")
	}
}

func TestChannelHandler_UpdateStream_InvalidID(t *testing.T) {
	h, _, _ := setupChannelHandler()
	app := testApp()
	app.Put("/api/admin/streams/:streamId", h.UpdateStream)

	result, status := makeRequest(app, "PUT", "/api/admin/streams/abc", `{"url":"http://new.com"}`)
	if status != 400 {
		t.Errorf("UpdateStream() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("UpdateStream() should return success=false")
	}
}

func TestChannelHandler_UpdateStream_InvalidBody(t *testing.T) {
	h, _, streamRepo := setupChannelHandler()
	stream := &model.Stream{ChannelID: 1, URL: "http://example.com/old.m3u8", StreamFormat: "hls"}
	streamRepo.Create(stream)
	app := testApp()
	app.Put("/api/admin/streams/:streamId", h.UpdateStream)

	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/streams/%d", stream.ID), "not-json")
	if status != 400 {
		t.Errorf("UpdateStream() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("UpdateStream() should return success=false")
	}
}

func TestChannelHandler_DeleteStream_InvalidID(t *testing.T) {
	h, _, _ := setupChannelHandler()
	app := testApp()
	app.Delete("/api/admin/streams/:streamId", h.DeleteStream)

	result, status := makeRequest(app, "DELETE", "/api/admin/streams/abc", "")
	if status != 400 {
		t.Errorf("DeleteStream() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("DeleteStream() should return success=false")
	}
}

func TestChannelHandler_ListActive_WithCategoryFilter(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	repo.addChannel(&model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true})
	app := testApp()
	app.Get("/api/channels", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/channels?category_id=1", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true")
	}
}

func TestChannelHandler_ListActive_WithSearch(t *testing.T) {
	h, repo, _ := setupChannelHandler()
	repo.addChannel(&model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true})
	app := testApp()
	app.Get("/api/channels", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/channels?search=Canal", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true")
	}
}
