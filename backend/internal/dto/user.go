package dto

import (
	"time"

	"github.com/google/uuid"
)

type CreateUserRequest struct {
	Username       string     `json:"username"`
	Email          string     `json:"email"`
	Password       string     `json:"password"`
	Role           string     `json:"role"`
	MaxConnections int        `json:"max_connections"`
	ExpDate        *time.Time `json:"exp_date"`
}

type UpdateUserRequest struct {
	Username       string     `json:"username"`
	Email          string     `json:"email"`
	Password       string     `json:"password"`
	Role           string     `json:"role"`
	IsActive       *bool      `json:"is_active"`
	MaxConnections *int       `json:"max_connections"`
	ExpDate        *time.Time `json:"exp_date"`
}

type UserResponse struct {
	ID             uuid.UUID  `json:"id"`
	Username       string     `json:"username"`
	Email          string     `json:"email"`
	Role           string     `json:"role"`
	IsActive       bool       `json:"is_active"`
	MaxConnections int        `json:"max_connections"`
	ExpDate        *time.Time `json:"exp_date"`
	CreatedAt      time.Time  `json:"created_at"`
}
