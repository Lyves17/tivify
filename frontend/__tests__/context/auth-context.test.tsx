import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/context/auth-context'

// Mock the API module
jest.mock('@/lib/api', () => ({
  authAPI: {
    me: jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'test-user',
          username: 'testuser',
          email: 'test@example.com',
          role: 'user',
          is_active: true,
        },
      },
    }),
    login: jest.fn(),
    logout: jest.fn(),
  },
}))

// Mock the secure token store
jest.mock('@/lib/secure-token-store', () => ({
  secureTokenStore: {
    getToken: jest.fn().mockReturnValue(null),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  },
}))

function TestComponent() {
  const auth = useAuth()
  return (
    <div>
      <p>Loading: {auth.isLoading ? 'true' : 'false'}</p>
      <p>Authenticated: {auth.isAuthenticated ? 'true' : 'false'}</p>
      {auth.user && <p>User: {auth.user.username}</p>}
    </div>
  )
}

describe('AuthContext', () => {
  it('provides auth context to children', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for loading to complete (getToken returns null → resolves immediately)
    await waitFor(() => {
      expect(screen.getByText('Loading: false')).toBeInTheDocument()
    })

    // Not authenticated when no token
    expect(screen.getByText('Authenticated: false')).toBeInTheDocument()
  })

  it('throws error when useAuth is used outside AuthProvider', () => {
    // Mock console.error to suppress error output during test
    const consoleError = jest.spyOn(console, 'error').mockImplementation()

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth debe usarse dentro de AuthProvider')

    consoleError.mockRestore()
  })
})
