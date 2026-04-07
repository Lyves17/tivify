package util

import "testing"

func TestHashPassword(t *testing.T) {
	password := "SecurePass123"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	if hash == "" {
		t.Fatal("HashPassword() returned empty hash")
	}
	if hash == password {
		t.Fatal("HashPassword() returned the password itself")
	}
}

func TestHashPassword_DifferentHashes(t *testing.T) {
	password := "SecurePass123"
	hash1, _ := HashPassword(password)
	hash2, _ := HashPassword(password)
	if hash1 == hash2 {
		t.Fatal("HashPassword() should produce different hashes for same password (bcrypt uses random salt)")
	}
}

func TestCheckPasswordHash_Correct(t *testing.T) {
	password := "SecurePass123"
	hash, _ := HashPassword(password)
	if !CheckPasswordHash(password, hash) {
		t.Fatal("CheckPasswordHash() should return true for correct password")
	}
}

func TestCheckPasswordHash_Wrong(t *testing.T) {
	password := "SecurePass123"
	hash, _ := HashPassword(password)
	if CheckPasswordHash("WrongPassword", hash) {
		t.Fatal("CheckPasswordHash() should return false for wrong password")
	}
}

func TestCheckPasswordHash_EmptyPassword(t *testing.T) {
	hash, _ := HashPassword("SomePassword1")
	if CheckPasswordHash("", hash) {
		t.Fatal("CheckPasswordHash() should return false for empty password")
	}
}
