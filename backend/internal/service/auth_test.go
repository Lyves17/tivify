package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/config"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/util"
	"gorm.io/gorm"
)

func init() {
	util.InitJWT("test-secret-key-at-least-32-chars!!", 15*time.Minute)
}

// --- Mock UserRepository ---

type mockUserRepo struct {
	users map[string]*model.User
	byID  map[uuid.UUID]*model.User
}

func newMockUserRepo() *mockUserRepo {
	return &mockUserRepo{
		users: make(map[string]*model.User),
		byID:  make(map[uuid.UUID]*model.User),
	}
}

func (m *mockUserRepo) FindByUsername(username string) (*model.User, error) {
	u, ok := m.users[username]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}

func (m *mockUserRepo) FindByID(id uuid.UUID) (*model.User, error) {
	u, ok := m.byID[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}

func (m *mockUserRepo) Create(user *model.User) error {
	m.users[user.Username] = user
	m.byID[user.ID] = user
	return nil
}

func (m *mockUserRepo) addUser(user *model.User) {
	m.users[user.Username] = user
	m.byID[user.ID] = user
}

// --- Mock SessionRepository ---

type mockSessionRepo struct {
	sessions    map[string]*model.Session
	byID        map[uuid.UUID]*model.Session
	countByUser map[uuid.UUID]int64
}

func newMockSessionRepo() *mockSessionRepo {
	return &mockSessionRepo{
		sessions:    make(map[string]*model.Session),
		byID:        make(map[uuid.UUID]*model.Session),
		countByUser: make(map[uuid.UUID]int64),
	}
}

func (m *mockSessionRepo) Create(session *model.Session) error {
	m.sessions[session.RefreshToken] = session
	m.byID[session.ID] = session
	m.countByUser[session.UserID]++
	return nil
}

func (m *mockSessionRepo) FindByRefreshToken(token string) (*model.Session, error) {
	s, ok := m.sessions[token]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return s, nil
}

func (m *mockSessionRepo) DeleteByID(id uuid.UUID) error {
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

func (m *mockSessionRepo) CountActiveByUser(userID uuid.UUID) (int64, error) {
	return m.countByUser[userID], nil
}

func (m *mockSessionRepo) DeleteOldestByUser(userID uuid.UUID) error {
	if m.countByUser[userID] > 0 {
		m.countByUser[userID]--
	}
	return nil
}

// --- Helpers ---

func testConfig() *config.Config {
	return &config.Config{
		JWTSecret:          "test-secret-key-at-least-32-chars!!",
		JWTExpiry:          15 * time.Minute,
		RefreshTokenExpiry: 7 * 24 * time.Hour,
		AdminUsername:      "admin",
		AdminPassword:      "AdminPass123",
		AdminEmail:         "admin@test.com",
	}
}

func createTestUser(username, password string) *model.User {
	hash, _ := util.HashPassword(password)
	return &model.User{
		ID:             uuid.New(),
		Username:       username,
		Email:          username + "@test.com",
		PasswordHash:   hash,
		Role:           "user",
		IsActive:       true,
		MaxConnections: 1,
	}
}

// --- Tests ---

func TestLogin_Success(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	userRepo.addUser(user)

	resp, refreshToken, err := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"Mozilla/5.0", "192.168.1.1",
	)
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if resp == nil {
		t.Fatal("Login() returned nil response")
	}
	if resp.AccessToken == "" {
		t.Error("Login() access token is empty")
	}
	if refreshToken == "" {
		t.Error("Login() refresh token is empty")
	}
	if resp.User.Username != "testuser" {
		t.Errorf("Login() username = %q, want %q", resp.User.Username, "testuser")
	}
	if resp.User.ID != user.ID {
		t.Errorf("Login() user ID = %v, want %v", resp.User.ID, user.ID)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	userRepo.addUser(user)

	_, _, err := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "WrongPassword"},
		"Mozilla/5.0", "192.168.1.1",
	)
	if err == nil {
		t.Fatal("Login() should return error for wrong password")
	}
}

func TestLogin_UserNotFound(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	_, _, err := svc.Login(
		dto.LoginRequest{Username: "nonexistent", Password: "Password123"},
		"Mozilla/5.0", "192.168.1.1",
	)
	if err == nil {
		t.Fatal("Login() should return error for nonexistent user")
	}
}

func TestLogin_InactiveUser(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	user.IsActive = false
	userRepo.addUser(user)

	_, _, err := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"Mozilla/5.0", "192.168.1.1",
	)
	if err == nil {
		t.Fatal("Login() should return error for inactive user")
	}
}

func TestLogin_ExpiredUser(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	past := time.Now().Add(-24 * time.Hour)
	user.ExpDate = &past
	userRepo.addUser(user)

	_, _, err := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"Mozilla/5.0", "192.168.1.1",
	)
	if err == nil {
		t.Fatal("Login() should return error for expired user")
	}
}

func TestLogin_MaxConnections_Evicts(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	user.MaxConnections = 1
	userRepo.addUser(user)

	// First login
	_, _, err := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"UA1", "1.1.1.1",
	)
	if err != nil {
		t.Fatalf("First Login() error = %v", err)
	}

	// Second login should succeed (evicts oldest)
	_, _, err = svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"UA2", "2.2.2.2",
	)
	if err != nil {
		t.Fatalf("Second Login() error = %v", err)
	}
}

func TestGetCurrentUser(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	userRepo.addUser(user)

	info, err := svc.GetCurrentUser(user.ID)
	if err != nil {
		t.Fatalf("GetCurrentUser() error = %v", err)
	}
	if info.Username != "testuser" {
		t.Errorf("GetCurrentUser() username = %q, want %q", info.Username, "testuser")
	}
	if info.Role != "user" {
		t.Errorf("GetCurrentUser() role = %q, want %q", info.Role, "user")
	}
}

func TestGetCurrentUser_NotFound(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	_, err := svc.GetCurrentUser(uuid.New())
	if err == nil {
		t.Fatal("GetCurrentUser() should return error for nonexistent user")
	}
}

func TestLogout(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	userRepo.addUser(user)

	_, refreshToken, _ := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"Mozilla/5.0", "192.168.1.1",
	)

	err := svc.Logout(refreshToken)
	if err != nil {
		t.Fatalf("Logout() error = %v", err)
	}
}

func TestLogout_InvalidToken(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	err := svc.Logout("nonexistent-token")
	if err != nil {
		t.Fatalf("Logout() with invalid token should not error, got %v", err)
	}
}

func TestRefreshToken_Success(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	userRepo.addUser(user)

	_, refreshToken, _ := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"Mozilla/5.0", "192.168.1.1",
	)

	resp, newRefresh, err := svc.RefreshToken(refreshToken)
	if err != nil {
		t.Fatalf("RefreshToken() error = %v", err)
	}
	if resp.AccessToken == "" {
		t.Error("RefreshToken() access token is empty")
	}
	if newRefresh == "" {
		t.Error("RefreshToken() new refresh token is empty")
	}
	if newRefresh == refreshToken {
		t.Error("RefreshToken() should rotate the refresh token")
	}
}

func TestRefreshToken_InvalidToken(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	_, _, err := svc.RefreshToken("nonexistent-token")
	if err == nil {
		t.Fatal("RefreshToken() should return error for invalid token")
	}
}

func TestSeedAdmin(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	cfg := testConfig()
	svc := NewAuthService(userRepo, sessionRepo, cfg)

	svc.SeedAdmin()

	admin, err := userRepo.FindByUsername(cfg.AdminUsername)
	if err != nil {
		t.Fatalf("SeedAdmin() did not create admin: %v", err)
	}
	if admin.Role != "admin" {
		t.Errorf("SeedAdmin() role = %q, want %q", admin.Role, "admin")
	}
	if !admin.IsActive {
		t.Error("SeedAdmin() admin should be active")
	}
	if admin.MaxConnections != 10 {
		t.Errorf("SeedAdmin() max_connections = %d, want 10", admin.MaxConnections)
	}
}

func TestSeedAdmin_AlreadyExists(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	cfg := testConfig()
	svc := NewAuthService(userRepo, sessionRepo, cfg)

	svc.SeedAdmin()
	firstAdmin, _ := userRepo.FindByUsername(cfg.AdminUsername)

	svc.SeedAdmin()
	secondAdmin, _ := userRepo.FindByUsername(cfg.AdminUsername)

	if firstAdmin.ID != secondAdmin.ID {
		t.Error("SeedAdmin() created duplicate admin")
	}
}

func TestRefreshToken_ExpiredSession(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	userRepo.addUser(user)

	// Create an expired session manually
	expired := time.Now().Add(-24 * time.Hour)
	session := &model.Session{
		ID:           uuid.New(),
		UserID:       user.ID,
		RefreshToken: "expired-token-123",
		ExpiresAt:    expired,
	}
	sessionRepo.Create(session)

	_, _, err := svc.RefreshToken("expired-token-123")
	if err == nil {
		t.Fatal("RefreshToken() should return error for expired session")
	}
	if err.Error() != "sesion expirada" {
		t.Errorf("error = %q, want %q", err.Error(), "sesion expirada")
	}
}

func TestRefreshToken_InactiveUser(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	userRepo.addUser(user)

	// Login first to create a session
	_, refreshToken, err := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"Mozilla/5.0", "192.168.1.1",
	)
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}

	// Deactivate the user after login
	user.IsActive = false

	_, _, err = svc.RefreshToken(refreshToken)
	if err == nil {
		t.Fatal("RefreshToken() should return error for inactive user")
	}
	if err.Error() != "usuario invalido" {
		t.Errorf("error = %q, want %q", err.Error(), "usuario invalido")
	}
}

func TestRefreshToken_UserDeleted(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	userRepo.addUser(user)

	_, refreshToken, err := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"Mozilla/5.0", "192.168.1.1",
	)
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}

	// Remove the user after login (simulating deletion)
	delete(userRepo.users, "testuser")
	delete(userRepo.byID, user.ID)

	_, _, err = svc.RefreshToken(refreshToken)
	if err == nil {
		t.Fatal("RefreshToken() should return error for deleted user")
	}
	if err.Error() != "usuario invalido" {
		t.Errorf("error = %q, want %q", err.Error(), "usuario invalido")
	}
}

func TestLogin_ResponseFields(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	user.Email = "test@example.com"
	user.Role = "admin"
	userRepo.addUser(user)

	resp, _, err := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"Mozilla/5.0", "192.168.1.1",
	)
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if resp.User.Email != "test@example.com" {
		t.Errorf("email = %q, want %q", resp.User.Email, "test@example.com")
	}
	if resp.User.Role != "admin" {
		t.Errorf("role = %q, want %q", resp.User.Role, "admin")
	}
	if !resp.User.IsActive {
		t.Error("user should be active")
	}
}

func TestRefreshToken_RotatesToken(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	svc := NewAuthService(userRepo, sessionRepo, testConfig())

	user := createTestUser("testuser", "Password123")
	userRepo.addUser(user)

	_, refreshToken1, _ := svc.Login(
		dto.LoginRequest{Username: "testuser", Password: "Password123"},
		"UA", "1.1.1.1",
	)

	_, refreshToken2, err := svc.RefreshToken(refreshToken1)
	if err != nil {
		t.Fatalf("RefreshToken() error = %v", err)
	}

	// Old token should no longer work
	_, _, err = svc.RefreshToken(refreshToken1)
	if err == nil {
		t.Error("old refresh token should be invalidated after rotation")
	}

	// New token should work
	_, refreshToken3, err := svc.RefreshToken(refreshToken2)
	if err != nil {
		t.Fatalf("new refresh token should work: %v", err)
	}
	if refreshToken3 == refreshToken2 {
		t.Error("refresh token should be rotated again")
	}
}

func TestLogin_EmptyUsername(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	cfg := &config.Config{AdminUsername: "admin", AdminPassword: "Admin12345"}
	svc := NewAuthService(userRepo, sessionRepo, cfg)

	_, _, err := svc.Login(dto.LoginRequest{Username: "", Password: "password"}, "", "")
	if err == nil {
		t.Error("Login with empty username should return error")
	}
}

func TestLogin_EmptyPassword(t *testing.T) {
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	hash, _ := util.HashPassword("ValidPass123")
	userRepo.addUser(&model.User{
		ID: uuid.New(), Username: "user1", PasswordHash: hash, IsActive: true, MaxConnections: 1,
	})
	cfg := &config.Config{AdminUsername: "admin", AdminPassword: "Admin12345"}
	svc := NewAuthService(userRepo, sessionRepo, cfg)

	_, _, err := svc.Login(dto.LoginRequest{Username: "user1", Password: ""}, "", "")
	if err == nil {
		t.Error("Login with empty password should return error")
	}
}

func TestSeedAdmin_CreateError(t *testing.T) {
	userRepo := &failCreateUserRepo{mockUserRepo: newMockUserRepo()}
	sessionRepo := newMockSessionRepo()
	cfg := &config.Config{AdminUsername: "admin", AdminPassword: "Admin12345", AdminEmail: "admin@test.com"}
	svc := NewAuthService(userRepo, sessionRepo, cfg)

	// Should not panic even when Create fails
	svc.SeedAdmin()
}

// failCreateUserRepo wraps mockUserRepo but makes Create fail
type failCreateUserRepo struct {
	*mockUserRepo
}

func (m *failCreateUserRepo) Create(user *model.User) error {
	return gorm.ErrInvalidTransaction
}

func TestSeedAdmin_DBError(t *testing.T) {
	userRepo := &dbErrorUserRepo{mockUserRepo: newMockUserRepo()}
	sessionRepo := newMockSessionRepo()
	cfg := &config.Config{AdminUsername: "admin", AdminPassword: "Admin12345", AdminEmail: "admin@test.com"}
	svc := NewAuthService(userRepo, sessionRepo, cfg)

	// Should not panic when FindByUsername returns unexpected error
	svc.SeedAdmin()
}

// dbErrorUserRepo returns a generic error from FindByUsername
type dbErrorUserRepo struct {
	*mockUserRepo
}

func (m *dbErrorUserRepo) FindByUsername(username string) (*model.User, error) {
	return nil, gorm.ErrInvalidDB
}
