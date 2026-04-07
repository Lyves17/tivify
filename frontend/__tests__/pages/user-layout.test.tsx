/**
 * Tests for the (user) layout component.
 * This layout handles:
 * - Auth redirect for unauthenticated users
 * - Navigation rendering (desktop + mobile)
 * - Admin link visibility based on role
 * - Mobile menu toggle
 * - Logout functionality
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock next/navigation
const mockReplace = jest.fn()
const mockPush = jest.fn()
let mockPathname = '/home'

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}))

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock GlobalSearch
jest.mock('@/components/ui/global-search', () => ({
  __esModule: true,
  default: () => <div data-testid="global-search">Search</div>,
}))

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Menu: ({ size, ...props }: any) => <span data-testid="menu-icon" {...props}>Menu</span>,
  X: ({ size, ...props }: any) => <span data-testid="x-icon" {...props}>X</span>,
}))

// Mock auth context
const mockLogout = jest.fn().mockResolvedValue(undefined)
let mockAuthValue: any = {
  user: { id: '1', username: 'testuser', role: 'user', is_active: true },
  isLoading: false,
  isAuthenticated: true,
  login: jest.fn(),
  logout: mockLogout,
}

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockAuthValue,
}))

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

import UserLayout from '@/app/(user)/layout'

describe('UserLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPathname = '/home'
    mockAuthValue = {
      user: { id: '1', username: 'testuser', role: 'user', is_active: true },
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      logout: mockLogout,
    }
  })

  it('renders children when authenticated', () => {
    render(
      <UserLayout>
        <div>Page Content</div>
      </UserLayout>
    )

    expect(screen.getByText('Page Content')).toBeInTheDocument()
  })

  it('renders loading state when isLoading is true', () => {
    mockAuthValue = {
      ...mockAuthValue,
      isLoading: true,
      isAuthenticated: false,
      user: null,
    }

    render(
      <UserLayout>
        <div>Page Content</div>
      </UserLayout>
    )

    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.queryByText('Page Content')).not.toBeInTheDocument()
  })

  it('returns null when not authenticated and not loading', () => {
    mockAuthValue = {
      ...mockAuthValue,
      isLoading: false,
      isAuthenticated: false,
      user: null,
    }

    const { container } = render(
      <UserLayout>
        <div>Page Content</div>
      </UserLayout>
    )

    expect(container.innerHTML).toBe('')
  })

  it('redirects to /login when not authenticated', () => {
    mockAuthValue = {
      ...mockAuthValue,
      isLoading: false,
      isAuthenticated: false,
      user: null,
    }

    render(
      <UserLayout>
        <div>Page Content</div>
      </UserLayout>
    )

    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('renders TIVIFY brand link', () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    const brandLink = screen.getByText('TIVIFY')
    expect(brandLink.closest('a')).toHaveAttribute('href', '/home')
  })

  it('renders all navigation links', () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    expect(screen.getAllByText('Inicio').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Canales').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Peliculas').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Series').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Guia TV').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Favoritos').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Historial').length).toBeGreaterThanOrEqual(1)
  })

  it('shows username in the header', () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    expect(screen.getAllByText('testuser').length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT show admin link for regular users', () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows admin link for admin users', () => {
    mockAuthValue = {
      ...mockAuthValue,
      user: { id: '1', username: 'admin', role: 'admin', is_active: true },
    }

    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('shows admin panel link in mobile menu for admin users', () => {
    mockAuthValue = {
      ...mockAuthValue,
      user: { id: '1', username: 'admin', role: 'admin', is_active: true },
    }

    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    // Open mobile menu
    const menuButton = screen.getByLabelText('Open navigation menu')
    fireEvent.click(menuButton)

    expect(screen.getByText('Panel Admin')).toBeInTheDocument()
  })

  it('toggles mobile menu on button click', () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    // Initially no mobile nav visible
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()

    // Open
    const openButton = screen.getByLabelText('Open navigation menu')
    fireEvent.click(openButton)

    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()

    // Close
    const closeButton = screen.getByLabelText('Close navigation menu')
    fireEvent.click(closeButton)

    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
  })

  it('marks the active nav item with aria-current="page"', () => {
    mockPathname = '/channels'

    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    // Find the Canales link within the main navigation
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' })
    const channelLinks = mainNav.querySelectorAll('a[aria-current="page"]')
    expect(channelLinks.length).toBe(1)
    expect(channelLinks[0].textContent).toBe('Canales')
  })

  it('handles logout and redirects to /login', async () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    const logoutButton = screen.getByText('Salir')
    fireEvent.click(logoutButton)

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('handles logout from mobile menu', async () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    // Open mobile menu
    const menuButton = screen.getByLabelText('Open navigation menu')
    fireEvent.click(menuButton)

    // Click mobile logout
    const logoutButton = screen.getByText('Cerrar Sesion')
    fireEvent.click(logoutButton)

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
    })
  })

  it('closes mobile menu when pathname changes', () => {
    const { rerender } = render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    // Open mobile menu
    const menuButton = screen.getByLabelText('Open navigation menu')
    fireEvent.click(menuButton)

    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()

    // Simulate pathname change
    mockPathname = '/channels'
    rerender(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    // Mobile menu should be closed now (useEffect on pathname)
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
  })

  it('renders skip-to-content link for accessibility', () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    const skipLink = screen.getByText('Saltar al contenido principal')
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('renders main content with correct id', () => {
    render(
      <UserLayout>
        <div>Page Content</div>
      </UserLayout>
    )

    const main = document.getElementById('main-content')
    expect(main).toBeInTheDocument()
    expect(main?.tagName).toBe('MAIN')
  })

  it('renders GlobalSearch component', () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    expect(screen.getAllByTestId('global-search').length).toBeGreaterThanOrEqual(1)
  })

  it('settings link points to /settings', () => {
    render(
      <UserLayout>
        <div>Content</div>
      </UserLayout>
    )

    const settingsLinks = screen.getAllByText('testuser')
    const link = settingsLinks.find(el => el.closest('a')?.getAttribute('href') === '/settings')
    expect(link).toBeDefined()
  })
})
