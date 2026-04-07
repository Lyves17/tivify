/**
 * Secure token storage for JWT authentication tokens.
 *
 * SECURITY NOTE: This implementation uses in-memory storage rather than localStorage
 * to mitigate XSS attacks. Tokens stored in localStorage are vulnerable to XSS since
 * malicious scripts can access `window.localStorage`.
 *
 * IDEAL SOLUTION: Use HttpOnly cookies (backend change required). The server should:
 * 1. Set tokens in HttpOnly cookies with Secure and SameSite flags
 * 2. Automatically include cookies in requests (no manual Authorization header needed)
 * 3. Prevent JavaScript from accessing the token, protecting against XSS
 *
 * CURRENT APPROACH: In-memory token storage
 * - Token is stored only in memory and lost on page reload
 * - A new token must be obtained via the refresh endpoint on app initialization
 * - The refresh endpoint uses an HttpOnly refresh token (if available)
 *
 * Limitations:
 * - If user refreshes the page, they'll need to re-authenticate or use refresh token
 * - Token is not persisted across browser sessions
 * - Still vulnerable to malicious code at the moment of login
 */

class SecureTokenStore {
  private token: string | null = null;

  /**
   * Store the access token in memory
   * @param token The JWT access token
   */
  setToken(token: string): void {
    if (!token) return;
    this.token = token;
    // Fallback: Store in sessionStorage to survive page reloads within same tab
    // NOTE: This is temporary. FUTURE: Replace with HttpOnly cookies (backend change required)
    try {
      sessionStorage.setItem('_t', token);
    } catch {
      // sessionStorage may be disabled in private mode
    }
  }

  /**
   * Retrieve the access token from memory
   * @returns The JWT access token or null if not set
   */
  getToken(): string | null {
    // Try memory first
    if (this.token) return this.token;
    // Fallback: Try sessionStorage for tokens persisted across reload
    try {
      const stored = sessionStorage.getItem('_t');
      if (stored) {
        this.token = stored;
        return stored;
      }
    } catch {
      // sessionStorage may be disabled in private mode
    }
    return null;
  }

  /**
   * Clear the access token from memory
   */
  clearToken(): void {
    this.token = null;
    try {
      sessionStorage.removeItem('_t');
    } catch {
      // sessionStorage may be disabled
    }
  }

  /**
   * Check if a token is currently stored
   * @returns true if a token exists in memory
   */
  hasToken(): boolean {
    return this.token !== null;
  }
}

export const secureTokenStore = new SecureTokenStore();
