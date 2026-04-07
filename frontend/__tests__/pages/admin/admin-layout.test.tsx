import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockReplace = jest.fn()
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es', changeLanguage: jest.fn() },
  }),
}))

jest.mock('lucide-react', () => ({
  Menu: (props: any) => <svg data-testid="menu-icon" {...props} />,
  X: (props: any) => <svg data-testid="close-icon" {...props} />,
}))

const mockAuth: any = {
  user: { username: 'admin', role: 'admin' },
  isLoading: false,
  logout: jest.fn().mockResolvedValue(undefined),
}

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockAuth,
}))

import AdminLayout from '@/app/admin/layout'

describe('AdminLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.user = { username: 'admin', role: 'admin' }
    mockAuth.isLoading = false
  })

  it('renders sidebar with nav links', () => {
    render(<AdminLayout><div>child content</div></AdminLayout>)

    expect(screen.getAllByText('TIVIFY').length).toBeGreaterThan(0)
    expect(screen.getByText('admin.adminPanel')).toBeInTheDocument()
    expect(screen.getByText('admin.dashboard')).toBeInTheDocument()
    expect(screen.getByText('admin.channels')).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('shows user info and logout button', () => {
    render(<AdminLayout><div>child</div></AdminLayout>)

    expect(screen.getAllByText('admin').length).toBeGreaterThan(0)
    expect(screen.getByText('auth.logoutShort')).toBeInTheDocument()
  })

  it('calls logout and redirects on logout click', async () => {
    render(<AdminLayout><div>child</div></AdminLayout>)

    fireEvent.click(screen.getByText('auth.logoutShort'))

    await waitFor(() => {
      expect(mockAuth.logout).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('shows loading state when auth is loading', () => {
    mockAuth.isLoading = true
    render(<AdminLayout><div>child</div></AdminLayout>)

    expect(screen.getByText('common.loading')).toBeInTheDocument()
    expect(screen.queryByText('child')).not.toBeInTheDocument()
  })

  it('redirects to login when user is not admin', () => {
    mockAuth.user = { username: 'user', role: 'user' }
    render(<AdminLayout><div>child</div></AdminLayout>)

    expect(mockReplace).toHaveBeenCalledWith('/login')
    expect(screen.queryByText('child')).not.toBeInTheDocument()
  })

  it('redirects to login when user is null', () => {
    mockAuth.user = null
    render(<AdminLayout><div>child</div></AdminLayout>)

    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('opens and closes mobile sidebar', () => {
    render(<AdminLayout><div>child</div></AdminLayout>)

    // Click menu button to open sidebar
    const menuButtons = screen.getAllByTestId('menu-icon')
    fireEvent.click(menuButtons[0].closest('button')!)

    // Click close button
    const closeButtons = screen.getAllByTestId('close-icon')
    fireEvent.click(closeButtons[0].closest('button')!)
  })

  it('closes sidebar overlay on click', () => {
    const { container } = render(<AdminLayout><div>child</div></AdminLayout>)

    // Open sidebar
    const menuButtons = screen.getAllByTestId('menu-icon')
    fireEvent.click(menuButtons[0].closest('button')!)

    // Find and click the overlay (bg-black/50 div)
    const overlay = container.querySelector('.bg-black\\/50')
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay!)
  })
})
