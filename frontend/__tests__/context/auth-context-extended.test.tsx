/**
 * Extended tests for auth-context.
 * Covers: login flow, logout flow, loadUser with token, loadUser error path,
 * WebSocket connect/disconnect, service worker registration.
 */
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '@/context/auth-context'

// Mock the API module
jest.mock('@/lib/api', () => ({
  authAPI: {
    me: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  },
}))

// Mock the secure token store
jest.mock('@/lib/secure-token-store', () => ({
  secureTokenStore: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  },
}))

// Track wsClient calls
jest.mock('@/lib/websocket', () => ({
  wsClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(() => jest.fn()),
    onAny: jest.fn(() => jest.fn()),
    connected: false,
  },
}))

jest.mock('@/lib/sw-register', () => ({
  registerServiceWorker: jest.fn(),
}))

jest.mock('@/lib/i18n', () => {})

import { authAPI } from '@/lib/api'
import { secureTokenStore } from '@/lib/secure-token-store'
import { wsClient } from '@/lib/websocket'
import { registerServiceWorker } from '@/lib/sw-register'

const mockMe = authAPI.me as jest.Mock
const mockLogin = authAPI.login as jest.Mock
const mockLogout = authAPI.logout as jest.Mock
const mockGetToken = secureTokenStore.getToken as jest.Mock
const mockSetToken = secureTokenStore.setToken as jest.Mock
const mockClearToken = secureTokenStore.clearToken as jest.Mock
const mockWsConnect = wsClient.connect as jest.Mock
const mockWsDisconnect = wsClient.disconnect as jest.Mock
const mockRegisterServiceWorker = registerServiceWorker as jest.Mock

// Test component with login/logout buttons
function TestConsumer() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth()
  return (
    <div>
      <p data-testid="loading">{isLoading ? 'loading' : 'ready'}</p>
      <p data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</p>
      {user && <p data-testid="username">{user.username}</p>}
      {user && <p data-testid="role">{user.role}</p>}
      <button
        data-testid="login-btn"
        onClick={() => login('admin', 'pass123').catch(() => {})}
      >
        Login
      </button>
      <button
        data-testid="logout-btn"
        onClick={() => logout().catch(() => {})}
      >
        Logout
      </button>
    </div>
  )
}

describe('AuthContext - extended tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetToken.mockReturnValue(null)
    mockLogout.mockResolvedValue({})
  })

  it('loads user when token exists on mount', async () => {
    mockGetToken.mockReturnValue('valid.jwt.token')
    mockMe.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'u1',
          username: 'admin',
          email: 'admin@test.com',
          role: 'admin',
          is_active: true,
        },
      },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('loading')

    // After load completes
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('authenticated').textContent).toBe('yes')
    expect(screen.getByTestId('username').textContent).toBe('admin')
    expect(screen.getByTestId('role').textContent).toBe('admin')
  })

  it('clears token and sets user null when me() fails', async () => {
    mockGetToken.mockReturnValue('expired.jwt.token')
    mockMe.mockRejectedValue(new Error('Unauthorized'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(mockClearToken).toHaveBeenCalled()
    expect(screen.getByTestId('authenticated').textContent).toBe('no')
  })

  it('does not call me() when no token exists', async () => {
    mockGetToken.mockReturnValue(null)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(mockMe).not.toHaveBeenCalled()
    expect(screen.getByTestId('authenticated').textContent).toBe('no')
  })

  it('login sets user and token on success', async () => {
    mockLogin.mockResolvedValue({
      data: {
        success: true,
        data: {
          access_token: 'new.jwt.token',
          user: {
            id: 'u2',
            username: 'newuser',
            email: 'new@test.com',
            role: 'user',
            is_active: true,
          },
        },
      },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    // Click login
    await act(async () => {
      fireEvent.click(screen.getByTestId('login-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes')
    })

    expect(mockSetToken).toHaveBeenCalledWith('new.jwt.token')
    expect(screen.getByTestId('username').textContent).toBe('newuser')
  })

  it('logout clears user and token', async () => {
    // Start with authenticated user
    mockGetToken.mockReturnValue('valid.jwt.token')
    mockMe.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'u1',
          username: 'admin',
          role: 'admin',
          is_active: true,
        },
      },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes')
    })

    // Click logout
    await act(async () => {
      fireEvent.click(screen.getByTestId('logout-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('no')
    })

    expect(mockClearToken).toHaveBeenCalled()
    expect(mockLogout).toHaveBeenCalled()
  })

  it('logout clears token even if API call fails', async () => {
    mockGetToken.mockReturnValue('valid.jwt.token')
    mockMe.mockResolvedValue({
      data: {
        success: true,
        data: { id: 'u1', username: 'admin', role: 'admin', is_active: true },
      },
    })
    mockLogout.mockRejectedValue(new Error('Network error'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes')
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('logout-btn'))
    })

    await waitFor(() => {
      expect(mockClearToken).toHaveBeenCalled()
      expect(screen.getByTestId('authenticated').textContent).toBe('no')
    })
  })

  it('connects WebSocket when user is set', async () => {
    mockGetToken.mockReturnValue('valid.jwt.token')
    mockMe.mockResolvedValue({
      data: {
        success: true,
        data: { id: 'u1', username: 'user1', role: 'user', is_active: true },
      },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes')
    })

    expect(mockWsConnect).toHaveBeenCalled()
  })

  it('disconnects WebSocket when user is null', async () => {
    mockGetToken.mockReturnValue(null)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    // WebSocket disconnect should be called (user is null)
    expect(mockWsDisconnect).toHaveBeenCalled()
  })

  it('registers service worker on mount', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(mockRegisterServiceWorker).toHaveBeenCalled()
  })

  it('does not set user when me() returns success=false', async () => {
    mockGetToken.mockReturnValue('valid.jwt.token')
    mockMe.mockResolvedValue({
      data: {
        success: false,
        data: null,
      },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('authenticated').textContent).toBe('no')
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestConsumer />)
    }).toThrow('useAuth debe usarse dentro de AuthProvider')

    spy.mockRestore()
  })
})

// Need to import fireEvent
import { fireEvent } from '@testing-library/react'
