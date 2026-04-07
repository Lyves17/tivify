import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import SettingsPage from '@/app/(user)/settings/page'

const mockLogout = jest.fn()
const mockUser = { username: 'testuser', role: 'admin', email: 'test@test.com' }

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}))

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}
jest.mock('@/context/toast-context', () => ({
  useToast: () => mockToast,
}))

jest.mock('@/lib/api')
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

// Mock axios for the version endpoint - must also provide create() for @/lib/api
jest.mock('axios', () => {
  const mockAxiosInstance: any = {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  }
  const mockAxios: any = {
    create: jest.fn(() => mockAxiosInstance),
    get: jest.fn().mockResolvedValue({
      data: { success: true, data: { version: '1.0.0', build_date: '2024-01-01' } },
    }),
    post: jest.fn(),
    isAxiosError: jest.fn(),
  }
  return { default: mockAxios, __esModule: true }
})

import { userAPI } from '@/lib/api'

const mockUpdateProfile = userAPI.updateProfile as jest.Mock
const mockChangePassword = userAPI.changePassword as jest.Mock

// Helper to get password inputs by their id attribute
function getInput(id: string): HTMLInputElement {
  const el = document.getElementById(id) as HTMLInputElement
  if (!el) throw new Error(`Input with id="${id}" not found`)
  return el
}

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateProfile.mockResolvedValue({})
    mockChangePassword.mockResolvedValue({})
    mockLogout.mockResolvedValue(undefined)
    i18n.changeLanguage('es')
    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    })
  })

  it('renders page title', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Ajustes')).toBeInTheDocument()
  })

  it('renders user info (username and role)', () => {
    render(<SettingsPage />)
    expect(screen.getByText('testuser')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('renders email update form', () => {
    render(<SettingsPage />)
    expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1)
    const emailInput = screen.getByDisplayValue('test@test.com')
    expect(emailInput).toBeInTheDocument()
  })

  it('submits email update form successfully', async () => {
    render(<SettingsPage />)
    const emailInput = screen.getByDisplayValue('test@test.com')
    fireEvent.change(emailInput, { target: { value: 'new@test.com' } })

    const saveButton = screen.getByRole('button', { name: /guardar cambios/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ email: 'new@test.com' })
    })

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Perfil actualizado correctamente')
    })
  })

  it('shows error on email update failure', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('fail'))

    render(<SettingsPage />)
    const saveButton = screen.getByRole('button', { name: /guardar cambios/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al actualizar perfil')
    })
  })

  it('renders password change form', () => {
    render(<SettingsPage />)
    expect(screen.getAllByText(/cambiar contrasena/i).length).toBeGreaterThanOrEqual(1)
    expect(getInput('current_password')).toBeInTheDocument()
    expect(getInput('new_password')).toBeInTheDocument()
    expect(getInput('confirm_password')).toBeInTheDocument()
  })

  it('validates empty current password', async () => {
    render(<SettingsPage />)
    const newPwInput = getInput('new_password')
    const confirmPwInput = getInput('confirm_password')
    fireEvent.change(newPwInput, { target: { value: 'newpass12' } })
    fireEvent.change(confirmPwInput, { target: { value: 'newpass12' } })

    // Submit the form directly to bypass HTML5 required validation
    const form = confirmPwInput.closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/contrasena actual es requerida/i)).toBeInTheDocument()
    })
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('validates empty new password', async () => {
    render(<SettingsPage />)
    const currentPwInput = getInput('current_password')
    fireEvent.change(currentPwInput, { target: { value: 'oldpass' } })

    // Submit the form directly to bypass HTML5 required validation
    const form = currentPwInput.closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/nueva contrasena es requerida/i)).toBeInTheDocument()
    })
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('validates password minimum length', async () => {
    render(<SettingsPage />)
    fireEvent.change(getInput('current_password'), { target: { value: 'oldpass' } })
    fireEvent.change(getInput('new_password'), { target: { value: 'short' } })
    fireEvent.change(getInput('confirm_password'), { target: { value: 'short' } })

    const changeBtn = screen.getByRole('button', { name: /^cambiar contrasena$/i })
    fireEvent.click(changeBtn)

    await waitFor(() => {
      expect(screen.getByText(/al menos 8 caracteres/i)).toBeInTheDocument()
    })
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('validates passwords match', async () => {
    render(<SettingsPage />)
    fireEvent.change(getInput('current_password'), { target: { value: 'oldpass' } })
    fireEvent.change(getInput('new_password'), { target: { value: 'newpassword1' } })
    fireEvent.change(getInput('confirm_password'), { target: { value: 'differentpass' } })

    const changeBtn = screen.getByRole('button', { name: /^cambiar contrasena$/i })
    fireEvent.click(changeBtn)

    await waitFor(() => {
      expect(screen.getByText(/contrasenas no coinciden/i)).toBeInTheDocument()
    })
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('submits password change successfully', async () => {
    render(<SettingsPage />)
    fireEvent.change(getInput('current_password'), { target: { value: 'oldpassword' } })
    fireEvent.change(getInput('new_password'), { target: { value: 'newpassword1' } })
    fireEvent.change(getInput('confirm_password'), { target: { value: 'newpassword1', name: 'confirm_password' } })

    const changeBtn = screen.getByRole('button', { name: /^cambiar contrasena$/i })
    fireEvent.click(changeBtn)

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        current_password: 'oldpassword',
        new_password: 'newpassword1',
      })
    })

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Contrasena cambiada correctamente')
    })
  })

  it('shows error on password change failure', async () => {
    mockChangePassword.mockRejectedValue(new Error('fail'))

    render(<SettingsPage />)
    fireEvent.change(getInput('current_password'), { target: { value: 'oldpassword' } })
    fireEvent.change(getInput('new_password'), { target: { value: 'newpassword1' } })
    fireEvent.change(getInput('confirm_password'), { target: { value: 'newpassword1', name: 'confirm_password' } })

    const changeBtn = screen.getByRole('button', { name: /^cambiar contrasena$/i })
    fireEvent.click(changeBtn)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Error al cambiar contrasena. Verifica tu contrasena actual.',
      )
    })
  })

  it('renders language selector with ES and EN buttons', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Idioma')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /espanol/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ingles/i })).toBeInTheDocument()
  })

  it('language selector switches language', async () => {
    render(<SettingsPage />)
    const englishBtn = screen.getByRole('button', { name: /ingles/i })
    fireEvent.click(englishBtn)

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  it('renders logout button', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('button', { name: /cerrar sesion/i })).toBeInTheDocument()
  })

  it('calls logout and redirects to /login', async () => {
    render(<SettingsPage />)
    const logoutBtn = screen.getByRole('button', { name: /cerrar sesion/i })
    fireEvent.click(logoutBtn)

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(window.location.href).toBe('/login')
    })
  })

  it('renders help link', () => {
    render(<SettingsPage />)
    const helpLink = screen.getByRole('link', { name: /ayuda/i })
    expect(helpLink).toHaveAttribute('href', '/help')
  })

  it('renders about section with app version', () => {
    render(<SettingsPage />)
    expect(screen.getByText(/acerca de/i)).toBeInTheDocument()
    expect(screen.getByText(/version de la app/i)).toBeInTheDocument()
  })

  // --- Additional coverage tests ---

  it('clears password errors when typing in a field with an error (lines 69-72)', async () => {
    render(<SettingsPage />)

    // Submit with empty current password to trigger error
    const form = getInput('current_password').closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/contrasena actual es requerida/i)).toBeInTheDocument()
    })

    // Now type in the current_password field - error should clear
    fireEvent.change(getInput('current_password'), { target: { value: 'a', name: 'current_password' } })

    await waitFor(() => {
      expect(screen.queryByText(/contrasena actual es requerida/i)).not.toBeInTheDocument()
    })
  })

  it('does not clear errors for fields without errors (line 68 branch)', async () => {
    render(<SettingsPage />)

    // Submit with empty current password and new password
    const form = getInput('current_password').closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/contrasena actual es requerida/i)).toBeInTheDocument()
      expect(screen.getByText(/nueva contrasena es requerida/i)).toBeInTheDocument()
    })

    // Type in new_password - only new_password error should clear, current_password error stays
    fireEvent.change(getInput('new_password'), { target: { value: 'x', name: 'new_password' } })

    await waitFor(() => {
      expect(screen.queryByText(/nueva contrasena es requerida/i)).not.toBeInTheDocument()
    })
    // current_password error should still be present
    expect(screen.getByText(/contrasena actual es requerida/i)).toBeInTheDocument()
  })

  it('clicking Spanish language button calls changeLanguage("es") (line 242)', async () => {
    // First switch to English
    render(<SettingsPage />)
    const englishBtn = screen.getByRole('button', { name: /ingles/i })
    fireEvent.click(englishBtn)

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    // Now click Spanish button
    const spanishBtn = screen.getByRole('button', { name: /spanish/i })
    fireEvent.click(spanishBtn)

    await waitFor(() => {
      expect(screen.getByText('Ajustes')).toBeInTheDocument()
    })
  })
})
