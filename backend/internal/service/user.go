package service

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/util"
)

// B20: TODO: Add context.Context parameter to all public methods
// This would enable cancellation of database operations like bulk user operations.

type UserService struct {
	userRepo FullUserRepository
}

func NewUserService(userRepo FullUserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

func (s *UserService) List(page, perPage int) ([]dto.UserResponse, int64, error) {
	users, total, err := s.userRepo.List(page, perPage)
	if err != nil {
		return nil, 0, err
	}
	var result []dto.UserResponse
	for _, u := range users {
		result = append(result, toUserResponse(u))
	}
	return result, total, nil
}

func (s *UserService) GetByID(id uuid.UUID) (*dto.UserResponse, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("usuario no encontrado")
	}
	resp := toUserResponse(*user)
	return &resp, nil
}

func (s *UserService) Create(req dto.CreateUserRequest) (*dto.UserResponse, error) {
	if req.Username == "" || req.Email == "" || req.Password == "" {
		return nil, errors.New("username, email y password son requeridos")
	}

	// B14: Validate email format
	if err := util.ValidateEmail(req.Email); err != nil {
		return nil, err
	}

	if existing, _ := s.userRepo.FindByUsername(req.Username); existing != nil {
		return nil, errors.New("username ya existe")
	}
	if existing, _ := s.userRepo.FindByEmail(req.Email); existing != nil {
		return nil, errors.New("email ya existe")
	}

	if err := util.ValidatePasswordStrength(req.Password); err != nil {
		return nil, err
	}

	hash, err := util.HashPassword(req.Password)
	if err != nil {
		return nil, errors.New("error procesando password")
	}

	role := req.Role
	if role == "" {
		role = "user"
	}
	maxConn := req.MaxConnections
	if maxConn <= 0 {
		maxConn = 1
	}

	user := &model.User{
		ID:             uuid.New(),
		Username:       req.Username,
		Email:          req.Email,
		PasswordHash:   hash,
		Role:           role,
		IsActive:       true,
		MaxConnections: maxConn,
		ExpDate:        req.ExpDate,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, errors.New("error creando usuario")
	}

	resp := toUserResponse(*user)
	return &resp, nil
}

func (s *UserService) Update(id uuid.UUID, req dto.UpdateUserRequest) (*dto.UserResponse, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("usuario no encontrado")
	}

	if req.Username != "" && req.Username != user.Username {
		if existing, _ := s.userRepo.FindByUsername(req.Username); existing != nil {
			return nil, errors.New("username ya existe")
		}
		user.Username = req.Username
	}
	if req.Email != "" && req.Email != user.Email {
		// B14: Validate email format
		if err := util.ValidateEmail(req.Email); err != nil {
			return nil, err
		}
		if existing, _ := s.userRepo.FindByEmail(req.Email); existing != nil {
			return nil, errors.New("email ya existe")
		}
		user.Email = req.Email
	}
	if req.Password != "" {
		if err := util.ValidatePasswordStrength(req.Password); err != nil {
			return nil, err
		}
		hash, err := util.HashPassword(req.Password)
		if err != nil {
			return nil, errors.New("error procesando password")
		}
		user.PasswordHash = hash
	}
	if req.Role != "" {
		user.Role = req.Role
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}
	if req.MaxConnections != nil {
		user.MaxConnections = *req.MaxConnections
	}
	user.ExpDate = req.ExpDate

	if err := s.userRepo.Update(user); err != nil {
		return nil, errors.New("error actualizando usuario")
	}

	resp := toUserResponse(*user)
	return &resp, nil
}

func (s *UserService) Delete(id uuid.UUID) error {
	return s.userRepo.Delete(id)
}

func (s *UserService) Count() (int64, error) {
	return s.userRepo.Count()
}

func (s *UserService) ChangePassword(userID uuid.UUID, req dto.ChangePasswordRequest) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("usuario no encontrado")
	}

	if !util.CheckPasswordHash(req.CurrentPassword, user.PasswordHash) {
		return errors.New("contrasena actual incorrecta")
	}

	if err := util.ValidatePasswordStrength(req.NewPassword); err != nil {
		return err
	}

	hash, err := util.HashPassword(req.NewPassword)
	if err != nil {
		return errors.New("error procesando password")
	}

	user.PasswordHash = hash
	return s.userRepo.Update(user)
}

func (s *UserService) UpdateProfile(userID uuid.UUID, req dto.UpdateProfileRequest) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("usuario no encontrado")
	}

	if req.Email != "" && req.Email != user.Email {
		// B14: Validate email format
		if err := util.ValidateEmail(req.Email); err != nil {
			return err
		}
		if existing, _ := s.userRepo.FindByEmail(req.Email); existing != nil {
			return errors.New("email ya existe")
		}
		user.Email = req.Email
	}

	return s.userRepo.Update(user)
}

func toUserResponse(u model.User) dto.UserResponse {
	var expDate *time.Time
	if u.ExpDate != nil {
		expDate = u.ExpDate
	}
	return dto.UserResponse{
		ID:             u.ID,
		Username:       u.Username,
		Email:          u.Email,
		Role:           u.Role,
		IsActive:       u.IsActive,
		MaxConnections: u.MaxConnections,
		ExpDate:        expDate,
		CreatedAt:      u.CreatedAt,
	}
}
