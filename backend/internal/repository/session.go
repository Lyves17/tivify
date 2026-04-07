package repository

import (
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type SessionRepository struct {
	db *gorm.DB
}

func NewSessionRepository(db *gorm.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) Create(session *model.Session) error {
	return r.db.Create(session).Error
}

func (r *SessionRepository) FindByRefreshToken(token string) (*model.Session, error) {
	var session model.Session
	err := r.db.Where("refresh_token = ?", token).First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *SessionRepository) DeleteByID(id uuid.UUID) error {
	return r.db.Delete(&model.Session{}, "id = ?", id).Error
}

func (r *SessionRepository) DeleteByUserID(userID uuid.UUID) error {
	return r.db.Where("user_id = ?", userID).Delete(&model.Session{}).Error
}

func (r *SessionRepository) DeleteExpired() error {
	return r.db.Where("expires_at < NOW()").Delete(&model.Session{}).Error
}

// CountActiveByUser returns the number of non-expired sessions for a user.
func (r *SessionRepository) CountActiveByUser(userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&model.Session{}).Where("user_id = ? AND expires_at > NOW()", userID).Count(&count).Error
	return count, err
}

// DeleteOldestByUser deletes the oldest active session for a user (to enforce max connections).
func (r *SessionRepository) DeleteOldestByUser(userID uuid.UUID) error {
	var oldest model.Session
	err := r.db.Where("user_id = ? AND expires_at > NOW()", userID).Order("created_at ASC").First(&oldest).Error
	if err != nil {
		return err
	}
	return r.db.Delete(&model.Session{}, "id = ?", oldest.ID).Error
}
