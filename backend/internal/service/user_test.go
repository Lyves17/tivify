package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock FullUserRepository ---

type mockFullUserRepo struct {
	users   map[string]*model.User
	byID    map[uuid.UUID]*model.User
	byEmail map[string]*model.User
}

func newMockFullUserRepo() *mockFullUserRepo {
	return &mockFullUserRepo{
		users:   make(map[string]*model.User),
		byID:    make(map[uuid.UUID]*model.User),
		byEmail: make(map[string]*model.User),
	}
}

func (m *mockFullUserRepo) FindByUsername(username string) (*model.User, error) {
	u, ok := m.users[username]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}

func (m *mockFullUserRepo) FindByID(id uuid.UUID) (*model.User, error) {
	u, ok := m.byID[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}

func (m *mockFullUserRepo) Create(user *model.User) error {
	m.users[user.Username] = user
	m.byID[user.ID] = user
	m.byEmail[user.Email] = user
	return nil
}

func (m *mockFullUserRepo) FindByEmail(email string) (*model.User, error) {
	u, ok := m.byEmail[email]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}

func (m *mockFullUserRepo) Update(user *model.User) error {
	m.users[user.Username] = user
	m.byID[user.ID] = user
	m.byEmail[user.Email] = user
	return nil
}

func (m *mockFullUserRepo) Delete(id uuid.UUID) error {
	u, ok := m.byID[id]
	if !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.users, u.Username)
	delete(m.byID, id)
	delete(m.byEmail, u.Email)
	return nil
}

func (m *mockFullUserRepo) List(page, perPage int) ([]model.User, int64, error) {
	var users []model.User
	for _, u := range m.byID {
		users = append(users, *u)
	}
	total := int64(len(users))
	start := (page - 1) * perPage
	if start >= len(users) {
		return nil, total, nil
	}
	end := start + perPage
	if end > len(users) {
		end = len(users)
	}
	return users[start:end], total, nil
}

func (m *mockFullUserRepo) ListRecent(limit int) ([]model.User, error) {
	var users []model.User
	for _, u := range m.byID {
		users = append(users, *u)
		if len(users) >= limit {
			break
		}
	}
	return users, nil
}

func (m *mockFullUserRepo) Count() (int64, error) {
	return int64(len(m.byID)), nil
}

func (m *mockFullUserRepo) addUser(user *model.User) {
	m.users[user.Username] = user
	m.byID[user.ID] = user
	m.byEmail[user.Email] = user
}

// --- UserService Tests ---

func TestUserService_List(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	u1 := createTestUser("user1", "Password123")
	u2 := createTestUser("user2", "Password123")
	repo.addUser(u1)
	repo.addUser(u2)

	users, total, err := svc.List(1, 20)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if total != 2 {
		t.Errorf("List() total = %d, want 2", total)
	}
	if len(users) != 2 {
		t.Errorf("List() returned %d users, want 2", len(users))
	}
}

func TestUserService_List_Empty(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	users, total, err := svc.List(1, 20)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if total != 0 {
		t.Errorf("List() total = %d, want 0", total)
	}
	if users != nil {
		t.Errorf("List() should return nil for empty list")
	}
}

func TestUserService_GetByID(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	resp, err := svc.GetByID(user.ID)
	if err != nil {
		t.Fatalf("GetByID() error = %v", err)
	}
	if resp.Username != "testuser" {
		t.Errorf("GetByID() username = %q, want %q", resp.Username, "testuser")
	}
	if resp.ID != user.ID {
		t.Errorf("GetByID() ID = %v, want %v", resp.ID, user.ID)
	}
}

func TestUserService_GetByID_NotFound(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	_, err := svc.GetByID(uuid.New())
	if err == nil {
		t.Fatal("GetByID() should return error for nonexistent user")
	}
}

func TestUserService_Create_Success(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	resp, err := svc.Create(dto.CreateUserRequest{
		Username: "newuser",
		Email:    "newuser@test.com",
		Password: "StrongPass123",
		Role:     "user",
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp.Username != "newuser" {
		t.Errorf("Create() username = %q, want %q", resp.Username, "newuser")
	}
	if resp.Email != "newuser@test.com" {
		t.Errorf("Create() email = %q, want %q", resp.Email, "newuser@test.com")
	}
	if resp.Role != "user" {
		t.Errorf("Create() role = %q, want %q", resp.Role, "user")
	}
	if !resp.IsActive {
		t.Error("Create() user should be active")
	}
}

func TestUserService_Create_DefaultRole(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	resp, err := svc.Create(dto.CreateUserRequest{
		Username: "newuser",
		Email:    "newuser@test.com",
		Password: "StrongPass123",
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp.Role != "user" {
		t.Errorf("Create() default role = %q, want %q", resp.Role, "user")
	}
}

func TestUserService_Create_DefaultMaxConnections(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	resp, err := svc.Create(dto.CreateUserRequest{
		Username: "newuser",
		Email:    "newuser@test.com",
		Password: "StrongPass123",
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp.MaxConnections != 1 {
		t.Errorf("Create() default max_connections = %d, want 1", resp.MaxConnections)
	}
}

func TestUserService_Create_EmptyFields(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	_, err := svc.Create(dto.CreateUserRequest{})
	if err == nil {
		t.Fatal("Create() should return error for empty fields")
	}
}

func TestUserService_Create_DuplicateUsername(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	existing := createTestUser("existinguser", "Password123")
	repo.addUser(existing)

	_, err := svc.Create(dto.CreateUserRequest{
		Username: "existinguser",
		Email:    "new@test.com",
		Password: "StrongPass123",
	})
	if err == nil {
		t.Fatal("Create() should return error for duplicate username")
	}
}

func TestUserService_Create_DuplicateEmail(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	existing := createTestUser("existinguser", "Password123")
	repo.addUser(existing)

	_, err := svc.Create(dto.CreateUserRequest{
		Username: "newuser",
		Email:    "existinguser@test.com",
		Password: "StrongPass123",
	})
	if err == nil {
		t.Fatal("Create() should return error for duplicate email")
	}
}

func TestUserService_Create_WeakPassword(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	_, err := svc.Create(dto.CreateUserRequest{
		Username: "newuser",
		Email:    "new@test.com",
		Password: "weak",
	})
	if err == nil {
		t.Fatal("Create() should return error for weak password")
	}
}

func TestUserService_Create_InvalidEmail(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	_, err := svc.Create(dto.CreateUserRequest{
		Username: "newuser",
		Email:    "not-an-email",
		Password: "StrongPass123",
	})
	if err == nil {
		t.Fatal("Create() should return error for invalid email")
	}
}

func TestUserService_Update_Success(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	isActive := false
	maxConn := 5
	resp, err := svc.Update(user.ID, dto.UpdateUserRequest{
		Username:       "updateduser",
		Email:          "updated@test.com",
		Role:           "admin",
		IsActive:       &isActive,
		MaxConnections: &maxConn,
	})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if resp.Username != "updateduser" {
		t.Errorf("Update() username = %q, want %q", resp.Username, "updateduser")
	}
	if resp.Email != "updated@test.com" {
		t.Errorf("Update() email = %q, want %q", resp.Email, "updated@test.com")
	}
	if resp.Role != "admin" {
		t.Errorf("Update() role = %q, want %q", resp.Role, "admin")
	}
	if resp.IsActive {
		t.Error("Update() user should be inactive")
	}
	if resp.MaxConnections != 5 {
		t.Errorf("Update() max_connections = %d, want 5", resp.MaxConnections)
	}
}

func TestUserService_Update_NotFound(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	_, err := svc.Update(uuid.New(), dto.UpdateUserRequest{Username: "newname"})
	if err == nil {
		t.Fatal("Update() should return error for nonexistent user")
	}
}

func TestUserService_Update_DuplicateUsername(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	u1 := createTestUser("user1", "Password123")
	u2 := createTestUser("user2", "Password123")
	repo.addUser(u1)
	repo.addUser(u2)

	_, err := svc.Update(u2.ID, dto.UpdateUserRequest{Username: "user1"})
	if err == nil {
		t.Fatal("Update() should return error for duplicate username")
	}
}

func TestUserService_Update_DuplicateEmail(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	u1 := createTestUser("user1", "Password123")
	u2 := createTestUser("user2", "Password123")
	repo.addUser(u1)
	repo.addUser(u2)

	_, err := svc.Update(u2.ID, dto.UpdateUserRequest{Email: "user1@test.com"})
	if err == nil {
		t.Fatal("Update() should return error for duplicate email")
	}
}

func TestUserService_Update_WithPassword(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	_, err := svc.Update(user.ID, dto.UpdateUserRequest{Password: "NewStrongPass456"})
	if err != nil {
		t.Fatalf("Update() with password error = %v", err)
	}
}

func TestUserService_Update_InvalidEmail(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	_, err := svc.Update(user.ID, dto.UpdateUserRequest{Email: "not-an-email"})
	if err == nil {
		t.Fatal("Update() should return error for invalid email format")
	}
}

func TestUserService_Update_SameUsername(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	// Updating with same username should be a no-op (no collision check)
	resp, err := svc.Update(user.ID, dto.UpdateUserRequest{Username: "testuser"})
	if err != nil {
		t.Fatalf("Update() with same username error = %v", err)
	}
	if resp.Username != "testuser" {
		t.Errorf("Update() username = %q", resp.Username)
	}
}

func TestUserService_Update_SameEmail(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	// Updating with same email should be a no-op (no collision or validation check)
	resp, err := svc.Update(user.ID, dto.UpdateUserRequest{Email: user.Email})
	if err != nil {
		t.Fatalf("Update() with same email error = %v", err)
	}
	if resp.Email != user.Email {
		t.Errorf("Update() email = %q", resp.Email)
	}
}

func TestUserService_Update_WeakPassword(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	_, err := svc.Update(user.ID, dto.UpdateUserRequest{Password: "weak"})
	if err == nil {
		t.Fatal("Update() should return error for weak password")
	}
}

func TestUserService_Delete(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	err := svc.Delete(user.ID)
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}

	// Verify deleted
	_, err = svc.GetByID(user.ID)
	if err == nil {
		t.Error("GetByID() should return error after delete")
	}
}

func TestUserService_Count(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	u1 := createTestUser("user1", "Password123")
	u2 := createTestUser("user2", "Password123")
	repo.addUser(u1)
	repo.addUser(u2)

	count, err := svc.Count()
	if err != nil {
		t.Fatalf("Count() error = %v", err)
	}
	if count != 2 {
		t.Errorf("Count() = %d, want 2", count)
	}
}

func TestUserService_ChangePassword_Success(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	err := svc.ChangePassword(user.ID, dto.ChangePasswordRequest{
		CurrentPassword: "Password123",
		NewPassword:     "NewStrongPass456",
	})
	if err != nil {
		t.Fatalf("ChangePassword() error = %v", err)
	}
}

func TestUserService_ChangePassword_WrongCurrent(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	err := svc.ChangePassword(user.ID, dto.ChangePasswordRequest{
		CurrentPassword: "WrongPassword",
		NewPassword:     "NewStrongPass456",
	})
	if err == nil {
		t.Fatal("ChangePassword() should return error for wrong current password")
	}
}

func TestUserService_ChangePassword_WeakNew(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	err := svc.ChangePassword(user.ID, dto.ChangePasswordRequest{
		CurrentPassword: "Password123",
		NewPassword:     "weak",
	})
	if err == nil {
		t.Fatal("ChangePassword() should return error for weak new password")
	}
}

func TestUserService_ChangePassword_NotFound(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	err := svc.ChangePassword(uuid.New(), dto.ChangePasswordRequest{
		CurrentPassword: "Password123",
		NewPassword:     "NewStrongPass456",
	})
	if err == nil {
		t.Fatal("ChangePassword() should return error for nonexistent user")
	}
}

func TestUserService_UpdateProfile_Success(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	err := svc.UpdateProfile(user.ID, dto.UpdateProfileRequest{
		Email: "newemail@test.com",
	})
	if err != nil {
		t.Fatalf("UpdateProfile() error = %v", err)
	}

	updated, _ := svc.GetByID(user.ID)
	if updated.Email != "newemail@test.com" {
		t.Errorf("UpdateProfile() email = %q, want %q", updated.Email, "newemail@test.com")
	}
}

func TestUserService_UpdateProfile_DuplicateEmail(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	u1 := createTestUser("user1", "Password123")
	u2 := createTestUser("user2", "Password123")
	repo.addUser(u1)
	repo.addUser(u2)

	err := svc.UpdateProfile(u2.ID, dto.UpdateProfileRequest{
		Email: "user1@test.com",
	})
	if err == nil {
		t.Fatal("UpdateProfile() should return error for duplicate email")
	}
}

func TestUserService_UpdateProfile_NotFound(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	err := svc.UpdateProfile(uuid.New(), dto.UpdateProfileRequest{
		Email: "new@test.com",
	})
	if err == nil {
		t.Fatal("UpdateProfile() should return error for nonexistent user")
	}
}

func TestUserService_UpdateProfile_InvalidEmail(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	err := svc.UpdateProfile(user.ID, dto.UpdateProfileRequest{
		Email: "not-a-valid-email",
	})
	if err == nil {
		t.Fatal("UpdateProfile() should return error for invalid email format")
	}
}

func TestUserService_UpdateProfile_EmptyEmail(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	// Empty email should be a no-op
	err := svc.UpdateProfile(user.ID, dto.UpdateProfileRequest{
		Email: "",
	})
	if err != nil {
		t.Fatalf("UpdateProfile() with empty email error = %v", err)
	}

	updated, _ := svc.GetByID(user.ID)
	if updated.Email != user.Email {
		t.Errorf("email should be preserved, got %q", updated.Email)
	}
}

func TestUserService_UpdateProfile_SameEmail(t *testing.T) {
	repo := newMockFullUserRepo()
	svc := NewUserService(repo)

	user := createTestUser("testuser", "Password123")
	repo.addUser(user)

	// Updating with same email should be a no-op
	err := svc.UpdateProfile(user.ID, dto.UpdateProfileRequest{
		Email: user.Email,
	})
	if err != nil {
		t.Fatalf("UpdateProfile() with same email error = %v", err)
	}
}

func TestToUserResponse_WithExpDate(t *testing.T) {
	now := time.Now()
	user := model.User{
		ID:             uuid.New(),
		Username:       "testuser",
		Email:          "test@test.com",
		Role:           "user",
		IsActive:       true,
		MaxConnections: 2,
		ExpDate:        &now,
		CreatedAt:      now,
	}

	resp := toUserResponse(user)
	if resp.ExpDate == nil {
		t.Error("toUserResponse() ExpDate should not be nil when user has ExpDate")
	}
	if resp.Username != "testuser" {
		t.Errorf("toUserResponse() Username = %q, want testuser", resp.Username)
	}
}

func TestToUserResponse_NilExpDate(t *testing.T) {
	user := model.User{
		ID:             uuid.New(),
		Username:       "testuser",
		Email:          "test@test.com",
		Role:           "admin",
		IsActive:       true,
		MaxConnections: 5,
		ExpDate:        nil,
	}

	resp := toUserResponse(user)
	if resp.ExpDate != nil {
		t.Error("toUserResponse() ExpDate should be nil when user has no ExpDate")
	}
	if resp.Role != "admin" {
		t.Errorf("toUserResponse() Role = %q, want admin", resp.Role)
	}
}
