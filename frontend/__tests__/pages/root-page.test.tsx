import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockAuth: any = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
}

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockAuth,
}))

import Home from '@/app/page'

describe('Home (root page)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.isLoading = true
    mockAuth.isAuthenticated = false
    mockAuth.user = null
  })

  it('shows loading state while auth is loading', () => {
    render(<Home />)
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects to /login when not authenticated', async () => {
    mockAuth.isLoading = false
    mockAuth.isAuthenticated = false

    render(<Home />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('redirects to /admin when user is admin', async () => {
    mockAuth.isLoading = false
    mockAuth.isAuthenticated = true
    mockAuth.user = { role: 'admin' }

    render(<Home />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/admin')
    })
  })

  it('redirects to /home when user is not admin', async () => {
    mockAuth.isLoading = false
    mockAuth.isAuthenticated = true
    mockAuth.user = { role: 'user' }

    render(<Home />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home')
    })
  })
})
