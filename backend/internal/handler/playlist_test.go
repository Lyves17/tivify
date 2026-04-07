package handler

import (
	"fmt"
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupPlaylistHandler() (*PlaylistHandler, *mockPlaylistRepoH, *mockLocalMediaRepoH, *mockChannelRepoH, *mockStreamRepoH) {
	playlistRepo := newMockPlaylistRepoH()
	mediaRepo := newMockLocalMediaRepoH()
	channelRepo := newMockChannelRepoH()
	streamRepo := newMockStreamRepoH()
	svc := service.NewPlaylistService(playlistRepo, mediaRepo, channelRepo, streamRepo, "/tmp/media")
	handler := NewPlaylistHandler(svc)
	return handler, playlistRepo, mediaRepo, channelRepo, streamRepo
}

func TestPlaylistHandler_GetByChannel_NewPlaylist(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Get("/api/admin/channels/:id/playlist", h.GetByChannel)

	result, status := makeRequest(app, "GET", "/api/admin/channels/1/playlist", "")
	if status != 200 {
		t.Errorf("GetByChannel() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetByChannel() should return success=true")
	}
}

func TestPlaylistHandler_GetByChannel_ExistingPlaylist(t *testing.T) {
	h, playlistRepo, _, _, _ := setupPlaylistHandler()
	playlistRepo.Create(&model.Playlist{ChannelID: 1, PlaybackMode: "loop", IsActive: true})

	app := testApp()
	app.Get("/api/admin/channels/:id/playlist", h.GetByChannel)

	result, status := makeRequest(app, "GET", "/api/admin/channels/1/playlist", "")
	if status != 200 {
		t.Errorf("GetByChannel() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetByChannel() should return success=true")
	}
}

func TestPlaylistHandler_GetByChannel_InvalidID(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Get("/api/admin/channels/:id/playlist", h.GetByChannel)

	result, status := makeRequest(app, "GET", "/api/admin/channels/abc/playlist", "")
	if status != 400 {
		t.Errorf("GetByChannel() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GetByChannel() should return success=false for invalid ID")
	}
}

func TestPlaylistHandler_AddItem_Success(t *testing.T) {
	h, _, mediaRepo, _, _ := setupPlaylistHandler()
	// Create completed media
	mediaRepo.Create(&model.LocalMedia{
		OriginalFilename: "test.mp4",
		FilePath:         "/tmp/test.mp4",
		Status:           "completed",
	})

	app := testApp()
	app.Post("/api/admin/channels/:id/playlist/items", h.AddItem)

	body := `{"local_media_id":1,"sort_order":0}`
	result, status := makeRequest(app, "POST", "/api/admin/channels/1/playlist/items", body)
	if status != 201 {
		t.Errorf("AddItem() status = %d, want 201", status)
	}
	if !result.Success {
		t.Error("AddItem() should return success=true")
	}
}

func TestPlaylistHandler_AddItem_InvalidID(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Post("/api/admin/channels/:id/playlist/items", h.AddItem)

	result, status := makeRequest(app, "POST", "/api/admin/channels/abc/playlist/items", `{"local_media_id":1}`)
	if status != 400 {
		t.Errorf("AddItem() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("AddItem() should return success=false for invalid ID")
	}
}

func TestPlaylistHandler_AddItem_InvalidBody(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Post("/api/admin/channels/:id/playlist/items", h.AddItem)

	result, status := makeRequest(app, "POST", "/api/admin/channels/1/playlist/items", "not-json")
	if status != 400 {
		t.Errorf("AddItem() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("AddItem() should return success=false for invalid body")
	}
}

func TestPlaylistHandler_AddItem_MediaNotFound(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Post("/api/admin/channels/:id/playlist/items", h.AddItem)

	body := `{"local_media_id":999,"sort_order":0}`
	result, status := makeRequest(app, "POST", "/api/admin/channels/1/playlist/items", body)
	if status != 400 {
		t.Errorf("AddItem() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("AddItem() should return success=false when media not found")
	}
}

func TestPlaylistHandler_AddItem_MediaNotCompleted(t *testing.T) {
	h, _, mediaRepo, _, _ := setupPlaylistHandler()
	mediaRepo.Create(&model.LocalMedia{
		OriginalFilename: "test.mp4",
		FilePath:         "/tmp/test.mp4",
		Status:           "pending",
	})

	app := testApp()
	app.Post("/api/admin/channels/:id/playlist/items", h.AddItem)

	body := `{"local_media_id":1,"sort_order":0}`
	result, status := makeRequest(app, "POST", "/api/admin/channels/1/playlist/items", body)
	if status != 400 {
		t.Errorf("AddItem() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("AddItem() should return success=false when media not completed")
	}
}

func TestPlaylistHandler_RemoveItem_InvalidChannelID(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Delete("/api/admin/channels/:id/playlist/items/:itemId", h.RemoveItem)

	result, status := makeRequest(app, "DELETE", "/api/admin/channels/abc/playlist/items/1", "")
	if status != 400 {
		t.Errorf("RemoveItem() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("RemoveItem() should return success=false for invalid channel ID")
	}
}

func TestPlaylistHandler_RemoveItem_InvalidItemID(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Delete("/api/admin/channels/:id/playlist/items/:itemId", h.RemoveItem)

	result, status := makeRequest(app, "DELETE", "/api/admin/channels/1/playlist/items/abc", "")
	if status != 400 {
		t.Errorf("RemoveItem() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("RemoveItem() should return success=false for invalid item ID")
	}
}

func TestPlaylistHandler_RemoveItem_Success(t *testing.T) {
	h, playlistRepo, _, _, _ := setupPlaylistHandler()
	playlistRepo.Create(&model.Playlist{ChannelID: 1, PlaybackMode: "loop", IsActive: true})
	playlistRepo.AddItem(&model.PlaylistItem{PlaylistID: 1, LocalMediaID: 1, SortOrder: 0})

	app := testApp()
	app.Delete("/api/admin/channels/:id/playlist/items/:itemId", h.RemoveItem)

	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/channels/1/playlist/items/1"), "")
	if status != 200 {
		t.Errorf("RemoveItem() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("RemoveItem() should return success=true")
	}
}

func TestPlaylistHandler_Reorder_InvalidID(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Put("/api/admin/channels/:id/playlist/reorder", h.Reorder)

	result, status := makeRequest(app, "PUT", "/api/admin/channels/abc/playlist/reorder", `{"items":[]}`)
	if status != 400 {
		t.Errorf("Reorder() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Reorder() should return success=false for invalid ID")
	}
}

func TestPlaylistHandler_Reorder_InvalidBody(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Put("/api/admin/channels/:id/playlist/reorder", h.Reorder)

	result, status := makeRequest(app, "PUT", "/api/admin/channels/1/playlist/reorder", "not-json")
	if status != 400 {
		t.Errorf("Reorder() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Reorder() should return success=false for invalid body")
	}
}

func TestPlaylistHandler_Reorder_Success(t *testing.T) {
	h, playlistRepo, _, _, _ := setupPlaylistHandler()
	playlistRepo.Create(&model.Playlist{ChannelID: 1, PlaybackMode: "loop", IsActive: true})
	playlistRepo.AddItem(&model.PlaylistItem{PlaylistID: 1, LocalMediaID: 1, SortOrder: 0})
	playlistRepo.AddItem(&model.PlaylistItem{PlaylistID: 1, LocalMediaID: 2, SortOrder: 1})

	app := testApp()
	app.Put("/api/admin/channels/:id/playlist/reorder", h.Reorder)

	body := `{"items":[{"id":1,"sort_order":1},{"id":2,"sort_order":0}]}`
	result, status := makeRequest(app, "PUT", "/api/admin/channels/1/playlist/reorder", body)
	if status != 200 {
		t.Errorf("Reorder() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Reorder() should return success=true")
	}
}

func TestPlaylistHandler_UpdateMode_InvalidID(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Put("/api/admin/channels/:id/playlist/mode", h.UpdateMode)

	result, status := makeRequest(app, "PUT", "/api/admin/channels/abc/playlist/mode", `{"playback_mode":"loop"}`)
	if status != 400 {
		t.Errorf("UpdateMode() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("UpdateMode() should return success=false for invalid ID")
	}
}

func TestPlaylistHandler_UpdateMode_InvalidBody(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Put("/api/admin/channels/:id/playlist/mode", h.UpdateMode)

	result, status := makeRequest(app, "PUT", "/api/admin/channels/1/playlist/mode", "not-json")
	if status != 400 {
		t.Errorf("UpdateMode() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("UpdateMode() should return success=false for invalid body")
	}
}

func TestPlaylistHandler_UpdateMode_InvalidMode(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Put("/api/admin/channels/:id/playlist/mode", h.UpdateMode)

	body := `{"playback_mode":"invalid"}`
	result, status := makeRequest(app, "PUT", "/api/admin/channels/1/playlist/mode", body)
	if status != 400 {
		t.Errorf("UpdateMode() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("UpdateMode() should return success=false for invalid mode")
	}
}

func TestPlaylistHandler_UpdateMode_Success(t *testing.T) {
	h, playlistRepo, _, _, _ := setupPlaylistHandler()
	playlistRepo.Create(&model.Playlist{ChannelID: 1, PlaybackMode: "loop", IsActive: true})

	app := testApp()
	app.Put("/api/admin/channels/:id/playlist/mode", h.UpdateMode)

	body := `{"playback_mode":"shuffle"}`
	result, status := makeRequest(app, "PUT", "/api/admin/channels/1/playlist/mode", body)
	if status != 200 {
		t.Errorf("UpdateMode() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("UpdateMode() should return success=true")
	}
}

func TestPlaylistHandler_UpdateMode_NewPlaylist(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Put("/api/admin/channels/:id/playlist/mode", h.UpdateMode)

	body := `{"playback_mode":"once"}`
	result, status := makeRequest(app, "PUT", "/api/admin/channels/1/playlist/mode", body)
	if status != 200 {
		t.Errorf("UpdateMode() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("UpdateMode() should return success=true for new playlist")
	}
}

func TestPlaylistHandler_GenerateStream_InvalidID(t *testing.T) {
	h, _, _, _, _ := setupPlaylistHandler()

	app := testApp()
	app.Post("/api/admin/channels/:id/playlist/generate", h.GenerateStream)

	result, status := makeRequest(app, "POST", "/api/admin/channels/abc/playlist/generate", "")
	if status != 400 {
		t.Errorf("GenerateStream() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GenerateStream() should return success=false for invalid ID")
	}
}

func TestPlaylistHandler_GenerateStream_EmptyPlaylist(t *testing.T) {
	h, playlistRepo, _, _, _ := setupPlaylistHandler()
	playlistRepo.Create(&model.Playlist{ChannelID: 1, PlaybackMode: "loop", IsActive: true})

	app := testApp()
	app.Post("/api/admin/channels/:id/playlist/generate", h.GenerateStream)

	result, status := makeRequest(app, "POST", "/api/admin/channels/1/playlist/generate", "")
	if status != 400 {
		t.Errorf("GenerateStream() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GenerateStream() should return success=false for empty playlist")
	}
}

func TestPlaylistHandler_NewPlaylistHandler(t *testing.T) {
	_, _, _, _, _ = setupPlaylistHandler()
	// Test that it doesn't panic
}
