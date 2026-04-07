package util

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func testApp() *fiber.App {
	return fiber.New()
}

func TestSuccess(t *testing.T) {
	app := testApp()
	app.Get("/test", func(c *fiber.Ctx) error {
		return Success(c, map[string]string{"key": "value"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var result APIResponse
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if !result.Success {
		t.Error("expected success=true")
	}
	if result.Data == nil {
		t.Error("expected data to be present")
	}
}

func TestSuccess_NilData(t *testing.T) {
	app := testApp()
	app.Get("/test", func(c *fiber.Ctx) error {
		return Success(c, nil)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	var result APIResponse
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &result)

	if !result.Success {
		t.Error("expected success=true")
	}
}

func TestSuccessMessage(t *testing.T) {
	app := testApp()
	app.Get("/test", func(c *fiber.Ctx) error {
		return SuccessMessage(c, "operation completed")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	var result APIResponse
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &result)

	if !result.Success {
		t.Error("expected success=true")
	}
	if result.Message != "operation completed" {
		t.Errorf("expected message 'operation completed', got %q", result.Message)
	}
}

func TestError(t *testing.T) {
	tests := []struct {
		name       string
		status     int
		message    string
		wantStatus int
	}{
		{"bad request", 400, "invalid input", 400},
		{"not found", 404, "not found", 404},
		{"internal error", 500, "server error", 500},
		{"unauthorized", 401, "unauthorized", 401},
		{"forbidden", 403, "forbidden", 403},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := testApp()
			app.Get("/test", func(c *fiber.Ctx) error {
				return Error(c, tt.status, tt.message)
			})

			req := httptest.NewRequest("GET", "/test", nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("expected status %d, got %d", tt.wantStatus, resp.StatusCode)
			}

			var result APIResponse
			body, _ := io.ReadAll(resp.Body)
			json.Unmarshal(body, &result)

			if result.Success {
				t.Error("expected success=false")
			}
			if result.Message != tt.message {
				t.Errorf("expected message %q, got %q", tt.message, result.Message)
			}
		})
	}
}

func TestClampPagination(t *testing.T) {
	tests := []struct {
		name        string
		page        int
		perPage     int
		wantPage    int
		wantPerPage int
	}{
		{"valid values", 1, 20, 1, 20},
		{"page zero becomes 1", 0, 20, 1, 20},
		{"negative page becomes 1", -5, 20, 1, 20},
		{"perPage zero becomes 20", 1, 0, 1, 20},
		{"negative perPage becomes 20", 1, -1, 1, 20},
		{"perPage over 100 becomes 100", 1, 200, 1, 100},
		{"perPage exactly 100", 1, 100, 1, 100},
		{"perPage exactly 1", 1, 1, 1, 1},
		{"both invalid", -1, -1, 1, 20},
		{"large page number", 9999, 50, 9999, 50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPage, gotPerPage := ClampPagination(tt.page, tt.perPage)
			if gotPage != tt.wantPage {
				t.Errorf("ClampPagination(%d, %d) page = %d, want %d", tt.page, tt.perPage, gotPage, tt.wantPage)
			}
			if gotPerPage != tt.wantPerPage {
				t.Errorf("ClampPagination(%d, %d) perPage = %d, want %d", tt.page, tt.perPage, gotPerPage, tt.wantPerPage)
			}
		})
	}
}

func TestPaginated(t *testing.T) {
	tests := []struct {
		name      string
		total     int64
		page      int
		perPage   int
		wantPages int64
	}{
		{"exact division", 100, 1, 20, 5},
		{"with remainder", 101, 1, 20, 6},
		{"single page", 5, 1, 20, 1},
		{"zero items", 0, 1, 20, 0},
		{"one item", 1, 1, 20, 1},
		{"per page equals total", 20, 1, 20, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := testApp()
			app.Get("/test", func(c *fiber.Ctx) error {
				return Paginated(c, []string{}, tt.total, tt.page, tt.perPage)
			})

			req := httptest.NewRequest("GET", "/test", nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			defer resp.Body.Close()

			var result PaginatedResponse
			body, _ := io.ReadAll(resp.Body)
			json.Unmarshal(body, &result)

			if !result.Success {
				t.Error("expected success=true")
			}
			if result.Meta.Total != tt.total {
				t.Errorf("expected total %d, got %d", tt.total, result.Meta.Total)
			}
			if result.Meta.Page != tt.page {
				t.Errorf("expected page %d, got %d", tt.page, result.Meta.Page)
			}
			if result.Meta.PerPage != tt.perPage {
				t.Errorf("expected perPage %d, got %d", tt.perPage, result.Meta.PerPage)
			}
			if result.Meta.Pages != tt.wantPages {
				t.Errorf("expected pages %d, got %d", tt.wantPages, result.Meta.Pages)
			}
		})
	}
}
