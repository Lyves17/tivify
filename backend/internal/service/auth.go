package service

import (
	"errors"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/config"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/util"
	"gorm.io/gorm"
)

// UserRepository defines the interface for user data access (enables unit testing).
type UserRepository interface {
	FindByUsername(username string) (*model.User, error)
	FindByID(id uuid.UUID) (*model.User, error)
	Create(user *model.User) error
}

// SessionRepository defines the interface for session data access (enables unit testing).
type SessionRepository interface {
	Create(session *model.Session) error
	FindByRefreshToken(token string) (*model.Session, error)
	DeleteByID(id uuid.UUID) error
	CountActiveByUser(userID uuid.UUID) (int64, error)
	DeleteOldestByUser(userID uuid.UUID) error
}

type AuthService struct {
	userRepo    UserRepository
	sessionRepo SessionRepository
	cfg         *config.Config
}

func NewAuthService(userRepo UserRepository, sessionRepo SessionRepository, cfg *config.Config) *AuthService {
	return &AuthService{
		userRepo:    userRepo,
		sessionRepo: sessionRepo,
		cfg:         cfg,
	}
}

func (s *AuthService) Login(req dto.LoginRequest, userAgent, ipAddress string) (*dto.AuthResponse, string, error) {
	user, err := s.userRepo.FindByUsername(req.Username)
	if err != nil {
		return nil, "", errors.New("credenciales invalidas")
	}

	if !user.IsActive {
		return nil, "", errors.New("cuenta desactivada")
	}

	if user.ExpDate != nil && user.ExpDate.Before(time.Now()) {
		return nil, "", errors.New("cuenta expirada")
	}

	if !util.CheckPasswordHash(req.Password, user.PasswordHash) {
		return nil, "", errors.New("credenciales invalidas")
	}

	// Enforce MaxConnections: if user has reached limit, evict oldest session
	if user.MaxConnections > 0 {
		activeCount, _ := s.sessionRepo.CountActiveByUser(user.ID)
		for activeCount >= int64(user.MaxConnections) {
			if err := s.sessionRepo.DeleteOldestByUser(user.ID); err != nil {
				break
			}
			activeCount--
		}
	}

	accessToken, err := util.GenerateAccessToken(user.ID, user.Role)
	if err != nil {
		return nil, "", errors.New("error generando token")
	}

	refreshToken, err := util.GenerateRefreshToken()
	if err != nil {
		return nil, "", errors.New("error generando refresh token")
	}

	session := &model.Session{
		ID:           uuid.New(),
		UserID:       user.ID,
		RefreshToken: refreshToken,
		UserAgent:    userAgent,
		IPAddress:    ipAddress,
		ExpiresAt:    time.Now().Add(s.cfg.RefreshTokenExpiry),
	}

	if err := s.sessionRepo.Create(session); err != nil {
		return nil, "", errors.New("error creando sesion")
	}

	response := &dto.AuthResponse{
		AccessToken: accessToken,
		User: dto.UserInfo{
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			Role:     user.Role,
			IsActive: user.IsActive,
		},
	}

	return response, refreshToken, nil
}

func (s *AuthService) RefreshToken(refreshToken string) (*dto.RefreshResponse, string, error) {
	session, err := s.sessionRepo.FindByRefreshToken(refreshToken)
	if err != nil {
		return nil, "", errors.New("sesion invalida")
	}

	if session.ExpiresAt.Before(time.Now()) {
		s.sessionRepo.DeleteByID(session.ID)
		return nil, "", errors.New("sesion expirada")
	}

	user, err := s.userRepo.FindByID(session.UserID)
	if err != nil || !user.IsActive {
		return nil, "", errors.New("usuario invalido")
	}

	accessToken, err := util.GenerateAccessToken(user.ID, user.Role)
	if err != nil {
		return nil, "", errors.New("error generando token")
	}

	// Rotar refresh token
	newRefreshToken, err := util.GenerateRefreshToken()
	if err != nil {
		return nil, "", errors.New("error generando refresh token")
	}

	s.sessionRepo.DeleteByID(session.ID)

	newSession := &model.Session{
		ID:           uuid.New(),
		UserID:       user.ID,
		RefreshToken: newRefreshToken,
		UserAgent:    session.UserAgent,
		IPAddress:    session.IPAddress,
		ExpiresAt:    time.Now().Add(s.cfg.RefreshTokenExpiry),
	}
	if err := s.sessionRepo.Create(newSession); err != nil {
		return nil, "", errors.New("error creando nueva sesion")
	}

	return &dto.RefreshResponse{AccessToken: accessToken}, newRefreshToken, nil
}

func (s *AuthService) Logout(refreshToken string) error {
	session, err := s.sessionRepo.FindByRefreshToken(refreshToken)
	if err != nil {
		return nil
	}
	return s.sessionRepo.DeleteByID(session.ID)
}

func (s *AuthService) GetCurrentUser(userID uuid.UUID) (*dto.UserInfo, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, errors.New("usuario no encontrado")
	}

	return &dto.UserInfo{
		ID:       user.ID,
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
		IsActive: user.IsActive,
	}, nil
}

// SeedAdmin crea el usuario admin inicial si no existe
func (s *AuthService) SeedAdmin() {
	_, err := s.userRepo.FindByUsername(s.cfg.AdminUsername)
	if err == nil {
		log.Printf("Usuario admin '%s' ya existe", s.cfg.AdminUsername)
		return
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("Error buscando admin: %v", err)
		return
	}

	hash, err := util.HashPassword(s.cfg.AdminPassword)
	if err != nil {
		log.Printf("Error hasheando password de admin: %v", err)
		return
	}

	admin := &model.User{
		ID:             uuid.New(),
		Username:       s.cfg.AdminUsername,
		Email:          s.cfg.AdminEmail,
		PasswordHash:   hash,
		Role:           "admin",
		IsActive:       true,
		MaxConnections: 10,
	}

	if err := s.userRepo.Create(admin); err != nil {
		log.Printf("Error creando admin: %v", err)
		return
	}

	log.Printf("Usuario admin creado: %s", s.cfg.AdminUsername)
}
