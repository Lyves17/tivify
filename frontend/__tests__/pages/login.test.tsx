import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import LoginPage from '@/app/(auth)/login/page'

const mockPush = jest.fn()
const mockLogin = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

// Mock axios for isAxiosError
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    isAxiosError: (err: any) => err?.isAxiosError === true,
  },
  isAxiosError: (err: any) => err?.isAxiosError === true,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogin.mockResolvedValue(undefined)
    // Reset language to Spanish before each test
    i18n.changeLanguage('es')
  })

  it('renders login form with username and password inputs', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/usuario/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contrasena/i)).toBeInTheDocument()
  })

  it('renders app name and subtitle', () => {
    render(<LoginPage />)
    expect(screen.getByText('TIVIFY')).toBeInTheDocument()
    expect(screen.getByText(/plataforma de streaming/i)).toBeInTheDocument()
  })

  it('renders login button', () => {
    render(<LoginPage />)
    const button = screen.getByRole('button', { name: /iniciar sesion/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('shows validation via HTML required attributes for empty fields', () => {
    render(<LoginPage />)
    const usernameInput = screen.getByLabelText(/usuario/i)
    const passwordInput = screen.getByLabelText(/contrasena/i)
    expect(usernameInput).toBeRequired()
    expect(passwordInput).toBeRequired()
  })

  it('calls login on valid submission and redirects', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/contrasena/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'password123')
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('shows error on 401 response', async () => {
    mockLogin.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { message: '' } },
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/contrasena/i), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    await waitFor(() => {
      expect(screen.getByText(/credenciales invalidas/i)).toBeInTheDocument()
    })
  })

  it('shows error on 403 response', async () => {
    mockLogin.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: '' } },
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: 'disabled' } })
    fireEvent.change(screen.getByLabelText(/contrasena/i), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    await waitFor(() => {
      expect(screen.getByText(/cuenta desactivada/i)).toBeInTheDocument()
    })
  })

  it('shows connection error when no response', async () => {
    mockLogin.mockRejectedValue({
      isAxiosError: true,
      response: undefined,
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/contrasena/i), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    await waitFor(() => {
      expect(screen.getByText(/error de conexion/i)).toBeInTheDocument()
    })
  })

  it('shows server error on 500 response', async () => {
    mockLogin.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: {} },
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/contrasena/i), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    await waitFor(() => {
      expect(screen.getByText(/error del servidor/i)).toBeInTheDocument()
    })
  })

  it('shows unexpected error for non-axios errors', async () => {
    mockLogin.mockRejectedValue(new Error('Something broke'))

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/contrasena/i), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    await waitFor(() => {
      expect(screen.getByText(/error inesperado/i)).toBeInTheDocument()
    })
  })

  it('disables button while submitting', async () => {
    // Make login hang
    mockLogin.mockImplementation(() => new Promise(() => {}))

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/contrasena/i), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    await waitFor(() => {
      expect(screen.getByText(/iniciando sesion/i)).toBeInTheDocument()
    })
  })

  it('language toggle switches between ES and EN', async () => {
    render(<LoginPage />)
    // Default is ES, button should show EN
    const langButton = screen.getByRole('button', { name: /^EN$/i })
    expect(langButton).toBeInTheDocument()

    fireEvent.click(langButton)

    // After switching to EN, button should show ES
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^ES$/i })).toBeInTheDocument()
    })

    // Page content should now be in English - check heading
    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument()
    })
  })

  it('shows custom error message from server response', async () => {
    mockLogin.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { message: 'Custom error message from server' } },
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/contrasena/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    await waitFor(() => {
      expect(screen.getByText('Custom error message from server')).toBeInTheDocument()
    })
  })
})
