package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// newTestTailscaleHandler creates a TailscaleHandler with a custom HTTP client
// that routes to the provided mock server instead of the Docker socket.
func newTestTailscaleHandler(mockServer *httptest.Server) *TailscaleHandler {
	return &TailscaleHandler{
		client: mockServer.Client(),
	}
}

// overrideTailscaleBaseURL is a helper to make the handler use the mock server URL.
// Since doDockerRequest builds URLs as http://localhost/..., we need a mock that
// intercepts those requests. We achieve this by replacing the handler's client
// with one that uses the test server's transport.
func setupTailscaleTest(handler http.HandlerFunc) (*TailscaleHandler, *httptest.Server) {
	server := httptest.NewServer(handler)
	h := &TailscaleHandler{
		client: server.Client(),
	}
	return h, server
}

func TestTailscaleHandler_Status_ContainerRunning(t *testing.T) {
	// Mock Docker API response for inspect
	mockResp := map[string]interface{}{
		"State": map[string]interface{}{
			"Status":     "running",
			"Running":    true,
			"StartedAt":  "2024-01-01T00:00:00Z",
			"FinishedAt": "",
			"Error":      "",
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		json.NewEncoder(w).Encode(mockResp)
	}))
	defer server.Close()

	// Create handler with mock client that redirects to our test server
	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Get("/api/admin/tailscale/status", h.Status)

	result, status := makeRequest(app, "GET", "/api/admin/tailscale/status", "")
	if status != 200 {
		t.Errorf("Status() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Status() should return success=true when container is running")
	}
}

func TestTailscaleHandler_Status_ContainerNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
		w.Write([]byte(`{"message":"No such container"}`))
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Get("/api/admin/tailscale/status", h.Status)

	result, status := makeRequest(app, "GET", "/api/admin/tailscale/status", "")
	if status != 200 {
		t.Errorf("Status() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Status() should return success=true with not_found status")
	}
}

func TestTailscaleHandler_Status_DockerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		w.Write([]byte(`{"message":"Internal Server Error"}`))
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Get("/api/admin/tailscale/status", h.Status)

	result, status := makeRequest(app, "GET", "/api/admin/tailscale/status", "")
	if status != 500 {
		t.Errorf("Status() status = %d, want 500", status)
	}
	if result.Success {
		t.Error("Status() should return success=false for Docker API error")
	}
}

func TestTailscaleHandler_Start_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(204)
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/start", h.Start)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/start", "")
	if status != 200 {
		t.Errorf("Start() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Start() should return success=true when container starts")
	}
}

func TestTailscaleHandler_Start_AlreadyRunning(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(304)
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/start", h.Start)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/start", "")
	if status != 200 {
		t.Errorf("Start() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Start() should return success=true when container already running")
	}
}

func TestTailscaleHandler_Start_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/start", h.Start)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/start", "")
	if status != 404 {
		t.Errorf("Start() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("Start() should return success=false when container not found")
	}
}

func TestTailscaleHandler_Stop_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(204)
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/stop", h.Stop)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/stop", "")
	if status != 200 {
		t.Errorf("Stop() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Stop() should return success=true")
	}
}

func TestTailscaleHandler_Stop_AlreadyStopped(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(304)
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/stop", h.Stop)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/stop", "")
	if status != 200 {
		t.Errorf("Stop() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Stop() should return success=true when already stopped")
	}
}

func TestTailscaleHandler_Stop_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/stop", h.Stop)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/stop", "")
	if status != 404 {
		t.Errorf("Stop() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("Stop() should return success=false when container not found")
	}
}

func TestTailscaleHandler_Restart_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(204)
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/restart", h.Restart)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/restart", "")
	if status != 200 {
		t.Errorf("Restart() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Restart() should return success=true")
	}
}

func TestTailscaleHandler_Restart_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/restart", h.Restart)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/restart", "")
	if status != 404 {
		t.Errorf("Restart() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("Restart() should return success=false when container not found")
	}
}

func TestTailscaleHandler_Restart_DockerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/restart", h.Restart)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/restart", "")
	if status != 500 {
		t.Errorf("Restart() status = %d, want 500", status)
	}
	if result.Success {
		t.Error("Restart() should return success=false for Docker error")
	}
}

func TestTailscaleHandler_Start_DockerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/start", h.Start)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/start", "")
	if status != 500 {
		t.Errorf("Start() status = %d, want 500", status)
	}
	if result.Success {
		t.Error("Start() should return success=false for Docker error")
	}
}

func TestTailscaleHandler_Stop_DockerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	h := &TailscaleHandler{client: &http.Client{
		Transport: &rewriteTransport{base: server.Client().Transport, serverURL: server.URL},
	}}

	app := testApp()
	app.Post("/api/admin/tailscale/stop", h.Stop)

	result, status := makeRequest(app, "POST", "/api/admin/tailscale/stop", "")
	if status != 500 {
		t.Errorf("Stop() status = %d, want 500", status)
	}
	if result.Success {
		t.Error("Stop() should return success=false for Docker error")
	}
}

// rewriteTransport rewrites requests to http://localhost/... to use the test server URL instead.
type rewriteTransport struct {
	base      http.RoundTripper
	serverURL string
}

func (t *rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Rewrite URL from http://localhost/path to http://testserver/path
	req.URL.Scheme = "http"
	req.URL.Host = t.serverURL[len("http://"):]
	return t.base.RoundTrip(req)
}
