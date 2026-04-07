package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/config"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
	"gorm.io/gorm"
)

// mockSessionRepoH implements service.SessionRepository
type mockSessionRepoH struct {
	sessions    map[string]*model.Session
	byID        map[uuid.UUID]*model.Session
	countByUser map[uuid.UUID]int64
}

func newMockSessionRepoH() *mockSessionRepoH {
	return &mockSessionRepoH{
		sessions:    make(map[string]*model.Session),
		byID:        make(map[uuid.UUID]*model.Session),
		countByUser: make(map[uuid.UUID]int64),
	}
}

func (m *mockSessionRepoH) Create(session *model.Session) error {
	m.sessions[session.RefreshToken] = session
	m.byID[session.ID] = session
	m.countByUser[session.UserID]++
	return nil
}
func (m *mockSessionRepoH) FindByRefreshToken(token string) (*model.Session, error) {
	s, ok := m.sessions[token]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return s, nil
}
func (m *mockSessionRepoH) DeleteByID(id uuid.UUID) error {
	s, ok := m.byID[id]
	if ok {
		delete(m.sessions, s.RefreshToken)
		delete(m.byID, id)
		if m.countByUser[s.UserID] > 0 {
			m.countByUser[s.UserID]--
		}
	}
	return nil
}
func (m *mockSessionRepoH) CountActiveByUser(userID uuid.UUID) (int64, error) {
	return m.countByUser[userID], nil
}
func (m *mockSessionRepoH) DeleteOldestByUser(userID uuid.UUID) error {
	if m.countByUser[userID] > 0 {
		m.countByUser[userID]--
	}
	return nil
}

func testAuthConfig() *config.Config {
	return &config.Config{
		JWTSecret:          "test-secret-key-at-least-32-chars!!",
		JWTExpiry:          15 * time.Minute,
		RefreshTokenExpiry: 7 * 24 * time.Hour,
		AdminUsername:      "admin",
		AdminPassword:      "AdminPass123",
		AdminEmail:         "admin@test.com",
	}
}

func setupAuthHandler() (*AuthHandler, *mockUserRepoForHandler) {
	userRepo := newMockUserRepoH()
	sessionRepo := newMockSessionRepoH()
	cfg := testAuthConfig()
	authSvc := service.NewAuthService(userRepo, sessionRepo, cfg)
	userSvc := service.NewUserService(userRepo)
	handler := NewAuthHandler(authSvc, userSvc, cfg)
	return handler, userRepo
}

func TestAuthHandler_Login_Success(t *testing.T) {
	h, userRepo := setupAuthHandler()
	user := createTestUserH("testuser", "Password123")
	userRepo.addUser(user)

	app := testApp()
	app.Post("/api/auth/login", h.Login)

	body := `{"username":"testuser","password":"Password123"}`
	req := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("Login() status = %d, want 200", resp.StatusCode)
	}

	data, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(data, &result)

	if result["success"] != true {
		t.Error("Login() should return success=true")
	}
}

func TestAuthHandler_Login_InvalidCredentials(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Post("/api/auth/login", h.Login)

	body := `{"username":"nonexistent","password":"Password123"}`
	result, status := makeRequest(app, "POST", "/api/auth/login", body)

	if status != 401 {
		t.Errorf("Login() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("Login() should return success=false for invalid credentials")
	}
}

func TestAuthHandler_Login_InvalidBody(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Post("/api/auth/login", h.Login)

	result, status := makeRequest(app, "POST", "/api/auth/login", "not-json")

	if status != 400 {
		t.Errorf("Login() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Login() should return success=false for invalid body")
	}
}

func TestAuthHandler_Me(t *testing.T) {
	h, userRepo := setupAuthHandler()
	user := createTestUserH("testuser", "Password123")
	userRepo.addUser(user)

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", user.ID)
		return c.Next()
	})
	app.Get("/api/auth/me", h.Me)

	result, status := makeRequest(app, "GET", "/api/auth/me", "")

	if status != 200 {
		t.Errorf("Me() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Me() should return success=true")
	}
}

func TestAuthHandler_Logout(t *testing.T) {
	h, userRepo := setupAuthHandler()
	user := createTestUserH("testuser", "Password123")
	userRepo.addUser(user)

	app := testApp()
	app.Post("/api/auth/login", h.Login)
	app.Post("/api/auth/logout", h.Logout)

	loginBody := `{"username":"testuser","password":"Password123"}`
	loginReq := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginResp, _ := app.Test(loginReq, -1)

	var refreshCookie string
	for _, c := range loginResp.Cookies() {
		if c.Name == "refresh_token" {
			refreshCookie = c.Value
		}
	}
	loginResp.Body.Close()

	logoutReq := httptest.NewRequest("POST", "/api/auth/logout", nil)
	if refreshCookie != "" {
		logoutReq.Header.Set("Cookie", fmt.Sprintf("refresh_token=%s", refreshCookie))
	}
	logoutResp, _ := app.Test(logoutReq, -1)
	defer logoutResp.Body.Close()

	if logoutResp.StatusCode != 200 {
		t.Errorf("Logout() status = %d, want 200", logoutResp.StatusCode)
	}
}

func TestAuthHandler_ChangePassword(t *testing.T) {
	h, userRepo := setupAuthHandler()
	user := createTestUserH("testuser", "Password123")
	userRepo.addUser(user)

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", user.ID)
		return c.Next()
	})
	app.Post("/api/auth/change-password", h.ChangePassword)

	body := `{"current_password":"Password123","new_password":"NewStrongPass456"}`
	result, status := makeRequest(app, "POST", "/api/auth/change-password", body)

	if status != 200 {
		t.Errorf("ChangePassword() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ChangePassword() should return success=true")
	}
}

func TestAuthHandler_UpdateProfile(t *testing.T) {
	h, userRepo := setupAuthHandler()
	user := createTestUserH("testuser", "Password123")
	userRepo.addUser(user)

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", user.ID)
		return c.Next()
	})
	app.Put("/api/auth/profile", h.UpdateProfile)

	body := `{"email":"newemail@test.com"}`
	result, status := makeRequest(app, "PUT", "/api/auth/profile", body)

	if status != 200 {
		t.Errorf("UpdateProfile() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("UpdateProfile() should return success=true")
	}
}

func TestAuthHandler_Login_EmptyFields(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Post("/api/auth/login", h.Login)

	body := `{"username":"","password":""}`
	result, status := makeRequest(app, "POST", "/api/auth/login", body)
	if status != 400 {
		t.Errorf("Login() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Login() should return success=false for empty fields")
	}
}

func TestAuthHandler_Refresh_NoCookie(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Post("/api/auth/refresh", h.Refresh)

	result, status := makeRequest(app, "POST", "/api/auth/refresh", "")
	if status != 401 {
		t.Errorf("Refresh() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("Refresh() should return success=false when no cookie")
	}
}

func TestAuthHandler_Refresh_WithCookie(t *testing.T) {
	h, userRepo := setupAuthHandler()
	user := createTestUserH("testuser", "Password123")
	userRepo.addUser(user)

	// First login to get a refresh token
	app := testApp()
	app.Post("/api/auth/login", h.Login)
	app.Post("/api/auth/refresh", h.Refresh)

	loginBody := `{"username":"testuser","password":"Password123"}`
	loginReq := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginResp, _ := app.Test(loginReq, -1)

	var refreshCookie string
	for _, c := range loginResp.Cookies() {
		if c.Name == "refresh_token" {
			refreshCookie = c.Value
		}
	}
	loginResp.Body.Close()

	if refreshCookie == "" {
		t.Fatal("Login should set refresh_token cookie")
	}

	// Now refresh
	refreshReq := httptest.NewRequest("POST", "/api/auth/refresh", nil)
	refreshReq.Header.Set("Cookie", fmt.Sprintf("refresh_token=%s", refreshCookie))
	refreshResp, _ := app.Test(refreshReq, -1)
	defer refreshResp.Body.Close()

	if refreshResp.StatusCode != 200 {
		body, _ := io.ReadAll(refreshResp.Body)
		t.Errorf("Refresh() status = %d, want 200, body: %s", refreshResp.StatusCode, string(body))
	}
}

func TestAuthHandler_Me_NoAuth(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Get("/api/auth/me", h.Me)

	result, status := makeRequest(app, "GET", "/api/auth/me", "")
	if status != 401 {
		t.Errorf("Me() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("Me() should return success=false when not authenticated")
	}
}

func TestAuthHandler_Me_UserNotFound(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", uuid.New()) // Non-existent user
		return c.Next()
	})
	app.Get("/api/auth/me", h.Me)

	result, status := makeRequest(app, "GET", "/api/auth/me", "")
	if status != 404 {
		t.Errorf("Me() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("Me() should return success=false for non-existent user")
	}
}

func TestAuthHandler_ChangePassword_InvalidBody(t *testing.T) {
	h, userRepo := setupAuthHandler()
	user := createTestUserH("testuser", "Password123")
	userRepo.addUser(user)

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", user.ID)
		return c.Next()
	})
	app.Post("/api/auth/change-password", h.ChangePassword)

	result, status := makeRequest(app, "POST", "/api/auth/change-password", "not-json")
	if status != 400 {
		t.Errorf("ChangePassword() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("ChangePassword() should return success=false for invalid body")
	}
}

func TestAuthHandler_ChangePassword_NoAuth(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Post("/api/auth/change-password", h.ChangePassword)

	body := `{"current_password":"old","new_password":"new"}`
	result, status := makeRequest(app, "POST", "/api/auth/change-password", body)
	if status != 401 {
		t.Errorf("ChangePassword() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("ChangePassword() should return success=false when not authenticated")
	}
}

func TestAuthHandler_UpdateProfile_InvalidBody(t *testing.T) {
	h, userRepo := setupAuthHandler()
	user := createTestUserH("testuser", "Password123")
	userRepo.addUser(user)

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", user.ID)
		return c.Next()
	})
	app.Put("/api/auth/profile", h.UpdateProfile)

	result, status := makeRequest(app, "PUT", "/api/auth/profile", "not-json")
	if status != 400 {
		t.Errorf("UpdateProfile() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("UpdateProfile() should return success=false for invalid body")
	}
}

func TestAuthHandler_UpdateProfile_NoAuth(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Put("/api/auth/profile", h.UpdateProfile)

	body := `{"email":"new@test.com"}`
	result, status := makeRequest(app, "PUT", "/api/auth/profile", body)
	if status != 401 {
		t.Errorf("UpdateProfile() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("UpdateProfile() should return success=false when not authenticated")
	}
}

func TestAuthHandler_Refresh_InvalidToken(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Post("/api/auth/refresh", h.Refresh)

	req := httptest.NewRequest("POST", "/api/auth/refresh", nil)
	req.Header.Set("Cookie", "refresh_token=invalid-token-value")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 401 {
		t.Errorf("Refresh() status = %d, want 401", resp.StatusCode)
	}
}

func TestAuthHandler_Login_WrongPassword(t *testing.T) {
	h, userRepo := setupAuthHandler()
	user := createTestUserH("testuser", "Password123")
	userRepo.addUser(user)

	app := testApp()
	app.Post("/api/auth/login", h.Login)

	body := `{"username":"testuser","password":"WrongPassword"}`
	result, status := makeRequest(app, "POST", "/api/auth/login", body)
	if status != 401 {
		t.Errorf("Login() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("Login() should return success=false for wrong password")
	}
}

func TestAuthHandler_Logout_WithoutLogin(t *testing.T) {
	h, _ := setupAuthHandler()

	app := testApp()
	app.Post("/api/auth/logout", h.Logout)

	result, status := makeRequest(app, "POST", "/api/auth/logout", "")
	if status != 200 {
		t.Errorf("Logout() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Logout() should return success=true even without cookie")
	}
}

