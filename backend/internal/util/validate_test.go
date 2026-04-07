package util

import (
	"net"
	"strings"
	"testing"
)

func TestValidatePasswordStrength(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
		errMsg   string
	}{
		{"valid password", "Abcdef1234", false, ""},
		{"too short", "Ab1", true, "al menos 8"},
		{"too long", strings.Repeat("A", 129), true, "no puede exceder 128"},
		{"missing uppercase", "abcdef1234", true, "mayusculas"},
		{"missing lowercase", "ABCDEF1234", true, "mayusculas"},
		{"missing digit", "AbcdefGHIJ", true, "numeros"},
		{"exactly 8 chars valid", "Abcdef12", false, ""},
		{"exactly 128 chars valid", strings.Repeat("Aa1", 42) + "Aa", false, ""},
		{"only digits", "12345678", true, "mayusculas"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePasswordStrength(tt.password)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errMsg)
				} else if tt.errMsg != "" && !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("expected no error, got %v", err)
				}
			}
		})
	}
}

func TestValidateURL(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		field   string
		wantErr bool
	}{
		{"empty is valid (optional)", "", "poster_url", false},
		{"valid http", "http://example.com/image.jpg", "poster_url", false},
		{"valid https", "https://example.com/image.jpg", "poster_url", false},
		{"invalid url", "not a url", "poster_url", true},
		{"too long", "https://example.com/" + strings.Repeat("a", MaxURLLength), "poster_url", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateURL(tt.value, tt.field)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateURL(%q) error = %v, wantErr %v", tt.value, err, tt.wantErr)
			}
		})
	}
}

func TestValidateStringLength(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		maxLen  int
		wantErr bool
	}{
		{"within limit", "hello", 10, false},
		{"at limit", "hello", 5, false},
		{"exceeds limit", "hello world", 5, true},
		{"empty string", "", 5, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateStringLength(tt.value, "field", tt.maxLen)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateStringLength(%q, %d) error = %v, wantErr %v", tt.value, tt.maxLen, err, tt.wantErr)
			}
		})
	}
}

func TestValidateEmail(t *testing.T) {
	tests := []struct {
		name    string
		email   string
		wantErr bool
	}{
		{"valid email", "user@example.com", false},
		{"valid email with name", "User <user@example.com>", false},
		{"empty email", "", true},
		{"invalid format", "not-an-email", true},
		{"missing domain", "user@", true},
		{"too long", strings.Repeat("a", 250) + "@example.com", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateEmail(tt.email)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateEmail(%q) error = %v, wantErr %v", tt.email, err, tt.wantErr)
			}
		})
	}
}

func TestValidateStreamURL_Schemes(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
		errMsg  string
	}{
		{"empty url", "", true, "no puede estar vacia"},
		{"ftp scheme rejected", "ftp://example.com/file", true, "esquema de URL no permitido"},
		{"file scheme rejected", "file:///etc/passwd", true, "esquema de URL no permitido"},
		{"gopher scheme rejected", "gopher://example.com/", true, "esquema de URL no permitido"},
		{"no scheme", "example.com/stream", true, "esquema de URL no permitido"},
		{"too long url", "http://example.com/" + strings.Repeat("a", MaxURLLength), true, "excede el limite"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateStreamURL(tt.url)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				} else if tt.errMsg != "" && !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}
}

func TestValidateStreamURL_EdgeCases(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
		errMsg  string
	}{
		{"empty URL", "", true, "no puede estar vacia"},
		{"too long URL", "http://example.com/" + strings.Repeat("a", 2100), true, "excede el limite"},
		{"invalid scheme ftp", "ftp://example.com/stream", true, "esquema de URL no permitido"},
		{"invalid scheme file", "file:///etc/passwd", true, "esquema de URL no permitido"},
		{"no hostname", "http:///path/only", true, "no tiene hostname"},
		{"valid http google", "http://8.8.8.8/stream.m3u8", false, ""},
		{"dns resolution failure", "http://this-domain-definitely-does-not-exist-xyz123.invalid/stream", true, "no se pudo resolver"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateStreamURL(tt.url)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errMsg)
				} else if tt.errMsg != "" && !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("expected no error, got %v", err)
				}
			}
		})
	}
}

func TestIsPrivateIPAddress_IPv6(t *testing.T) {
	tests := []struct {
		name     string
		ip       string
		expected bool
	}{
		{"ipv6 loopback", "::1", true},
		{"ipv6 private fc00", "fc00::1", true},
		{"ipv6 link-local", "fe80::1", true},
		{"ipv6 public", "2001:4860:4860::8888", false},
		{"nil ip", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ip := net.ParseIP(tt.ip)
			result := isPrivateIPAddress(ip)
			if result != tt.expected {
				t.Errorf("isPrivateIPAddress(%v) = %v, want %v", tt.ip, result, tt.expected)
			}
		})
	}
}

func TestValidateStreamURL_PrivateIPs(t *testing.T) {
	privateURLs := []struct {
		name string
		url  string
	}{
		{"localhost", "http://localhost/stream"},
		{"loopback ipv4", "http://127.0.0.1/stream"},
		{"loopback ipv6", "http://[::1]/stream"},
		{"private 10.x", "http://10.0.0.1/stream"},
		{"private 172.16.x", "http://172.16.0.1/stream"},
		{"private 192.168.x", "http://192.168.1.1/stream"},
		{"link-local", "http://169.254.1.1/stream"},
	}

	for _, tt := range privateURLs {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateStreamURL(tt.url)
			if err == nil {
				t.Errorf("expected error for private URL %q, got nil", tt.url)
			}
		})
	}
}

func TestIsPrivateIP(t *testing.T) {
	tests := []struct {
		name     string
		ip       string
		expected bool
	}{
		{"localhost string", "localhost", true},
		{"loopback ipv4", "127.0.0.1", true},
		{"loopback ipv6", "::1", true},
		{"private 10.x", "10.0.0.1", true},
		{"private 172.16.x", "172.16.0.1", true},
		{"private 192.168.x", "192.168.1.100", true},
		{"public ip", "8.8.8.8", false},
		{"public ip 2", "1.1.1.1", false},
		{"random string", "notanip", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isPrivateIP(tt.ip)
			if result != tt.expected {
				t.Errorf("isPrivateIP(%q) = %v, want %v", tt.ip, result, tt.expected)
			}
		})
	}
}
