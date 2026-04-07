package util

import (
	"errors"
	"fmt"
	"net"
	"net/mail"
	"net/url"
	"strings"
	"unicode"
)

// Límites de longitud para campos comunes
const (
	MaxNameLength        = 200
	MaxSlugLength        = 200
	MaxDescriptionLength = 5000
	MaxURLLength         = 2048
	MaxSearchLength      = 100
	MaxHeadersLength     = 4096
	MaxEmailLength       = 254 // RFC 5321
)

// ValidateStringLength verifica que un string no exceda el largo máximo.
func ValidateStringLength(value, fieldName string, maxLen int) error {
	if len(value) > maxLen {
		return fmt.Errorf("%s excede el limite de %d caracteres", fieldName, maxLen)
	}
	return nil
}

// ValidateURL verifica que un string sea una URL válida y no exceda MaxURLLength.
// Retorna nil si el valor está vacío (campo opcional).
func ValidateURL(value, fieldName string) error {
	if value == "" {
		return nil
	}
	if len(value) > MaxURLLength {
		return fmt.Errorf("%s excede el limite de %d caracteres", fieldName, MaxURLLength)
	}
	_, err := url.ParseRequestURI(value)
	if err != nil {
		return fmt.Errorf("%s no es una URL valida", fieldName)
	}
	return nil
}

// ValidatePasswordStrength verifica que la contraseña cumpla requisitos mínimos:
// - Al menos 8 caracteres
// - Máximo 128 caracteres
// - Al menos una mayúscula, una minúscula y un dígito
func ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return errors.New("la contrasena debe tener al menos 8 caracteres")
	}
	if len(password) > 128 {
		return errors.New("la contrasena no puede exceder 128 caracteres")
	}

	var hasUpper, hasLower, hasDigit bool
	for _, c := range password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsLower(c):
			hasLower = true
		case unicode.IsDigit(c):
			hasDigit = true
		}
	}

	if !hasUpper || !hasLower || !hasDigit {
		return errors.New("la contrasena debe incluir mayusculas, minusculas y numeros")
	}
	return nil
}

// ValidateStreamURL validates a stream URL for SSRF attacks and security issues.
// - Validates URL scheme is http, https, rtmp, or rtsp
// - Blocks private/internal IP ranges
// - Resolves hostname and checks resolved IPs against private ranges
// - Returns descriptive error messages
func ValidateStreamURL(streamURL string) error {
	if streamURL == "" {
		return errors.New("URL del stream no puede estar vacia")
	}

	if len(streamURL) > MaxURLLength {
		return fmt.Errorf("URL del stream excede el limite de %d caracteres", MaxURLLength)
	}

	// Parse URL
	parsedURL, err := url.Parse(streamURL)
	if err != nil {
		return fmt.Errorf("URL del stream no es valida: %w", err)
	}

	// Validate scheme
	scheme := strings.ToLower(parsedURL.Scheme)
	if scheme != "http" && scheme != "https" && scheme != "rtmp" && scheme != "rtsp" {
		return fmt.Errorf("esquema de URL no permitido: %s (permitidos: http, https, rtmp, rtsp)", scheme)
	}

	// Extract hostname
	hostname := parsedURL.Hostname()
	if hostname == "" {
		return errors.New("URL del stream no tiene hostname valido")
	}

	// Check for private/internal IP addresses (literal)
	if isPrivateIP(hostname) {
		return fmt.Errorf("acceso a redes privadas bloqueado: %s", hostname)
	}

	// Resolve hostname and check resolved IPs
	ips, err := net.LookupIP(hostname)
	if err != nil {
		// DNS resolution failed - could be a private/internal domain
		return fmt.Errorf("no se pudo resolver el hostname: %s (%w)", hostname, err)
	}

	if len(ips) == 0 {
		return fmt.Errorf("hostname no resuelto a ninguna direccion IP: %s", hostname)
	}

	// Check each resolved IP
	for _, ip := range ips {
		if isPrivateIPAddress(ip) {
			return fmt.Errorf("hostname resuelto a una direccion privada bloqueada: %s -> %s", hostname, ip.String())
		}
	}

	return nil
}

// isPrivateIP checks if an IP address string is private/internal
func isPrivateIP(ipStr string) bool {
	// Parse as IP first
	ip := net.ParseIP(ipStr)
	if ip != nil {
		return isPrivateIPAddress(ip)
	}

	// Also check against private domains/patterns
	if ipStr == "localhost" || ipStr == "127.0.0.1" || ipStr == "::1" {
		return true
	}

	return false
}

// isPrivateIPAddress checks if an IP address is in private/internal ranges:
// - 127.0.0.0/8 (loopback)
// - 10.0.0.0/8 (private)
// - 172.16.0.0/12 (private)
// - 192.168.0.0/16 (private)
// - 169.254.0.0/16 (link-local)
// - ::1 (loopback IPv6)
// - fc00::/7 (private IPv6)
// - fe80::/10 (link-local IPv6)
func isPrivateIPAddress(ip net.IP) bool {
	if ip == nil {
		return false
	}

	// Loopback
	if ip.IsLoopback() {
		return true
	}

	// Private networks
	if ip.IsPrivate() {
		return true
	}

	// Link-local
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}

	// Additionally check known private ranges manually for safety
	ipStr := ip.String()

	// IPv4 private ranges
	privateV4Ranges := []string{
		"127.0.0.0/8",
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"169.254.0.0/16",
	}

	// IPv6 private ranges
	privateV6Ranges := []string{
		"::1/128",
		"fc00::/7",
		"fe80::/10",
	}

	ranges := privateV4Ranges
	if strings.Contains(ipStr, ":") {
		ranges = privateV6Ranges
	}

	for _, cidr := range ranges {
		_, net, err := net.ParseCIDR(cidr)
		if err == nil && net.Contains(ip) {
			return true
		}
	}

	return false
}

// B14: ValidateEmail validates an email address format
// - Uses net/mail parser for RFC 5322 validation
// - Checks length against MaxEmailLength (RFC 5321)
// - Returns error with descriptive message if invalid
func ValidateEmail(email string) error {
	if email == "" {
		return errors.New("email no puede estar vacio")
	}

	if len(email) > MaxEmailLength {
		return fmt.Errorf("email excede el limite de %d caracteres", MaxEmailLength)
	}

	// Use standard library parser for RFC 5322 validation
	_, err := mail.ParseAddress(email)
	if err != nil {
		return fmt.Errorf("formato de email invalido: %w", err)
	}

	return nil
}
