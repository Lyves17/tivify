package handler

import (
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupIPTVHandler() (*IPTVHandler, *mockChannelRepoH) {
	channelRepo := newMockChannelRepoH()
	streamRepo := newMockStreamRepoH()
	categoryRepo := newMockCategoryRepoH()
	epgRepo := newMockEPGRepoH()
	seeder := service.NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)
	return NewIPTVHandler(seeder, channelRepo), channelRepo
}

func TestIPTVHandler_Status(t *testing.T) {
	h, _ := setupIPTVHandler()

	app := testApp()
	app.Get("/api/admin/iptv/status", h.Status)

	result, status := makeRequest(app, "GET", "/api/admin/iptv/status", "")
	if status != 200 {
		t.Errorf("Status() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Status() should return success=true")
	}
}

func TestIPTVHandler_Import_InvalidBody(t *testing.T) {
	h, _ := setupIPTVHandler()

	app := testApp()
	app.Post("/api/admin/iptv/import", h.Import)

	result, status := makeRequest(app, "POST", "/api/admin/iptv/import", "not-json")
	if status != 400 {
		t.Errorf("Import() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Import() should return success=false for invalid body")
	}
}

func TestIPTVHandler_Import_Success(t *testing.T) {
	h, _ := setupIPTVHandler()

	app := testApp()
	app.Post("/api/admin/iptv/import", h.Import)

	body := `{"m3u_url":"http://example.com/list.m3u","source":"test"}`
	result, status := makeRequest(app, "POST", "/api/admin/iptv/import", body)
	if status != 200 {
		t.Errorf("Import() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Import() should return success=true")
	}
}

func TestIPTVHandler_Import_AlreadyRunning(t *testing.T) {
	channelRepo := newMockChannelRepoH()
	streamRepo := newMockStreamRepoH()
	categoryRepo := newMockCategoryRepoH()
	epgRepo := newMockEPGRepoH()
	seeder := service.NewIPTVSeeder(channelRepo, streamRepo, categoryRepo, epgRepo)

	h := NewIPTVHandler(seeder, channelRepo)

	app := testApp()
	app.Post("/api/admin/iptv/import", h.Import)

	body := `{"m3u_url":"http://example.com/list.m3u","source":"test"}`
	result, status := makeRequest(app, "POST", "/api/admin/iptv/import", body)
	if status != 200 {
		t.Errorf("Import() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Import() should return success=true")
	}
}

func TestIPTVHandler_Import_WithFilters(t *testing.T) {
	h, _ := setupIPTVHandler()

	app := testApp()
	app.Post("/api/admin/iptv/import", h.Import)

	body := `{
		"m3u_url": "http://example.com/list.m3u",
		"epg_url": "http://example.com/epg.xml",
		"countries": ["ES", "US"],
		"languages": ["spa", "eng"],
		"categories": ["news", "sports"],
		"replace": true,
		"source": "custom-source"
	}`
	result, status := makeRequest(app, "POST", "/api/admin/iptv/import", body)
	if status != 200 {
		t.Errorf("Import() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Import() should return success=true with filters")
	}
}

func TestIPTVHandler_DeleteBySource_DefaultSource(t *testing.T) {
	h, repo := setupIPTVHandler()
	// Add some channels with source "iptv-org"
	repo.addChannel(&model.Channel{Name: "Ch1", Source: "iptv-org", IsActive: true})
	repo.addChannel(&model.Channel{Name: "Ch2", Source: "iptv-org", IsActive: true})

	app := testApp()
	app.Delete("/api/admin/iptv/channels", h.DeleteBySource)

	// No ?source param → default is "iptv-org"
	result, status := makeRequest(app, "DELETE", "/api/admin/iptv/channels", "")
	if status != 200 {
		t.Errorf("DeleteBySource() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("DeleteBySource() should return success=true")
	}
}

func TestIPTVHandler_DeleteBySource_CustomSource(t *testing.T) {
	h, repo := setupIPTVHandler()
	repo.addChannel(&model.Channel{Name: "Ch1", Source: "custom-src", IsActive: true})

	app := testApp()
	app.Delete("/api/admin/iptv/channels", h.DeleteBySource)

	result, status := makeRequest(app, "DELETE", "/api/admin/iptv/channels?source=custom-src", "")
	if status != 200 {
		t.Errorf("DeleteBySource() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("DeleteBySource() should return success=true")
	}
}
