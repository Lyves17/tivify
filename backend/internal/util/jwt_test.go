package util

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func init() {
	// Initialize JWT for tests
	InitJWT("test-secret-key-at-least-32-chars!!", 15*time.Minute)
}

func TestGenerateAccessToken(t *testing.T) {
	userID := uuid.New()
	token, err := GenerateAccessToken(userID, "user")
	if err != nil {
		t.Fatalf("GenerateAccessToken() error = %v", err)
	}
	if token == "" {
		t.Fatal("GenerateAccessToken() returned empty token")
	}
}

func TestValidateAccessToken_Valid(t *testing.T) {
	userID := uuid.New()
	role := "admin"
	token, err := GenerateAccessToken(userID, role)
	if err != nil {
		t.Fatalf("GenerateAccessToken() error = %v", err)
	}

	claims, err := ValidateAccessToken(token)
	if err != nil {
		t.Fatalf("ValidateAccessToken() error = %v", err)
	}
	if claims.UserID != userID {
		t.Errorf("claims.UserID = %v, want %v", claims.UserID, userID)
	}
	if claims.Role != role {
		t.Errorf("claims.Role = %q, want %q", claims.Role, role)
	}
	if claims.Issuer != "tivify" {
		t.Errorf("claims.Issuer = %q, want %q", claims.Issuer, "tivify")
	}
}

func TestValidateAccessToken_Invalid(t *testing.T) {
	_, err := ValidateAccessToken("invalid-token-string")
	if err == nil {
		t.Fatal("ValidateAccessToken() should return error for invalid token")
	}
}

func TestValidateAccessToken_Expired(t *testing.T) {
	// Re-init JWT with 0 expiry to create expired tokens
	InitJWT("test-secret-key-at-least-32-chars!!", 0)
	defer InitJWT("test-secret-key-at-least-32-chars!!", 15*time.Minute) // restore

	userID := uuid.New()
	token, err := GenerateAccessToken(userID, "user")
	if err != nil {
		t.Fatalf("GenerateAccessToken() error = %v", err)
	}

	// Token with 0 duration is already expired
	time.Sleep(time.Millisecond)
	_, err = ValidateAccessToken(token)
	if err == nil {
		t.Fatal("ValidateAccessToken() should return error for expired token")
	}
}

func TestValidateAccessToken_WrongSecret(t *testing.T) {
	userID := uuid.New()
	token, _ := GenerateAccessToken(userID, "user")

	// Change secret
	InitJWT("different-secret-key-at-least-32-chars!!", 15*time.Minute)
	defer InitJWT("test-secret-key-at-least-32-chars!!", 15*time.Minute) // restore

	_, err := ValidateAccessToken(token)
	if err == nil {
		t.Fatal("ValidateAccessToken() should return error for wrong secret")
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	token, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken() error = %v", err)
	}
	if token == "" {
		t.Fatal("GenerateRefreshToken() returned empty token")
	}
	// Hex-encoded 32 bytes = 64 characters
	if len(token) != 64 {
		t.Errorf("GenerateRefreshToken() length = %d, want 64", len(token))
	}
}

func TestGenerateRefreshToken_Unique(t *testing.T) {
	token1, _ := GenerateRefreshToken()
	token2, _ := GenerateRefreshToken()
	if token1 == token2 {
		t.Fatal("GenerateRefreshToken() should produce unique tokens")
	}
}

func TestGenerateStreamToken(t *testing.T) {
	token, err := GenerateStreamToken()
	if err != nil {
		t.Fatalf("GenerateStreamToken() error = %v", err)
	}
	if len(token) != 64 {
		t.Errorf("GenerateStreamToken() length = %d, want 64", len(token))
	}
}

func TestGenerateStreamToken_Unique(t *testing.T) {
	token1, _ := GenerateStreamToken()
	token2, _ := GenerateStreamToken()
	if token1 == token2 {
		t.Fatal("GenerateStreamToken() should produce unique tokens")
	}
}

func TestValidateAccessToken_TamperedPayload(t *testing.T) {
	// A JWT with valid format but tampered payload (RS256 alg in header but HMAC body)
	tamperedToken := "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzIn0.fakesignature"
	_, err := ValidateAccessToken(tamperedToken)
	if err == nil {
		t.Fatal("ValidateAccessToken() should return error for tampered token with wrong alg")
	}
}

func TestValidateAccessToken_EmptyToken(t *testing.T) {
	_, err := ValidateAccessToken("")
	if err == nil {
		t.Fatal("ValidateAccessToken() should return error for empty token")
	}
}
