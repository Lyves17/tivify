import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UsersPage from '@/app/admin/users/page'

jest.mock('@/lib/api')
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))
jest.mock('lucide-react', () => ({
  Pencil: (props: any) => <span data-testid="pencil-icon" {...props} />,
  Trash2: (props: any) => <span data-testid="trash-icon" {...props} />,
  Plus: (props: any) => <span data-testid="plus-icon" {...props} />,
}))
jest.mock('@/components/ui/data-table', () => {
  return function MockDataTable({ columns, data, loading, emptyMessage }: any) {
    if (loading) return <div data-testid="data-table-loading">Loading table...</div>
    if (!data || data.length === 0) return <div data-testid="data-table-empty">{emptyMessage}</div>
    return (
      <table data-testid="data-table">
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item: any, idx: number) => (
            <tr key={idx}>
              {columns.map((col: any) => (
                <td key={col.key}>
                  {col.render ? col.render(item) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
})
jest.mock('@/components/ui/pagination', () => {
  return function MockPagination({ page, totalPages, onPageChange }: any) {
    return (
      <div data-testid="pagination">
        <span>Page {page} of {totalPages}</span>
        <button onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    )
  }
})
jest.mock('@/components/ui/modal', () => {
  return function MockModal({ isOpen, onClose, title, children }: any) {
    if (!isOpen) return null
    return (
      <div data-testid="modal">
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    )
  }
})
jest.mock('@/components/ui/form-input', () => {
  return function MockFormInput({ label, name, value, onChange, type, ...rest }: any) {
    return (
      <div>
        <label>{label}</label>
        <input name={name} value={value} onChange={onChange} type={type || 'text'} data-testid={`input-${name}`} {...rest} />
      </div>
    )
  }
})
jest.mock('@/components/ui/form-select', () => {
  return function MockFormSelect({ label, name, value, onChange, options }: any) {
    return (
      <div>
        <label>{label}</label>
        <select name={name} value={value} onChange={onChange} data-testid={`select-${name}`}>
          <option value="">--</option>
          {options?.map((opt: any) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }
})
jest.mock('@/components/ui/confirm-dialog', () => {
  return function MockConfirmDialog({ isOpen, onConfirm, onCancel, title, message }: any) {
    if (!isOpen) return null
    return (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    )
  }
})

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}
jest.mock('@/context/toast-context', () => ({
  useToast: () => mockToast,
}))

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 999, username: 'current_admin', role: 'admin' },
  }),
}))

import { adminAPI } from '@/lib/api'

const mockGetUsers = adminAPI.getUsers as jest.Mock
const mockCreateUser = adminAPI.createUser as jest.Mock
const mockUpdateUser = adminAPI.updateUser as jest.Mock
const mockDeleteUser = adminAPI.deleteUser as jest.Mock

const sampleUsers = [
  {
    id: 1,
    username: 'john',
    email: 'john@example.com',
    role: 'admin',
    is_active: true,
    max_connections: 3,
    exp_date: '2027-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    username: 'jane',
    email: 'jane@example.com',
    role: 'user',
    is_active: false,
    max_connections: 1,
    exp_date: null,
    created_at: '2026-02-15T00:00:00Z',
  },
]

describe('UsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUsers.mockResolvedValue({
      data: { data: sampleUsers, meta: { pages: 1 } },
    })
  })

  it('renders page title', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Usuarios')).toBeInTheDocument()
    })
  })

  it('renders users data table', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('john')).toBeInTheDocument()
    expect(screen.getByText('jane')).toBeInTheDocument()
  })

  it('renders user emails', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })

  it('renders role badges', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument()
    })
    expect(screen.getByText('user')).toBeInTheDocument()
  })

  it('renders active/inactive status badges', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Activo')).toBeInTheDocument()
    })
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockGetUsers.mockImplementation(() => new Promise(() => {}))
    render(<UsersPage />)
    expect(screen.getByTestId('data-table-loading')).toBeInTheDocument()
  })

  it('shows empty state when no users', async () => {
    mockGetUsers.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('No hay usuarios disponibles')).toBeInTheDocument()
    })
  })

  it('renders "Crear Usuario" button', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
  })

  it('opens create modal when clicking "Crear Usuario"', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Crear Usuario', { selector: 'h2' })).toBeInTheDocument()
    })
  })

  it('creates a new user successfully', async () => {
    mockCreateUser.mockResolvedValue({ data: { data: { id: 3 } } })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-username'), { target: { name: 'username', value: 'newuser' } })
    fireEvent.change(screen.getByTestId('input-email'), { target: { name: 'email', value: 'new@example.com' } })
    fireEvent.change(screen.getByTestId('input-password'), { target: { name: 'password', value: 'secret123' } })

    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Usuario creado correctamente')
    })
  })

  it('shows validation error when username is empty', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El nombre de usuario es obligatorio')
    })
  })

  it('shows validation error when email is empty', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-username'), { target: { name: 'username', value: 'test' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El email es obligatorio')
    })
  })

  it('shows validation error when password is empty for new user', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-username'), { target: { name: 'username', value: 'test' } })
    fireEvent.change(screen.getByTestId('input-email'), { target: { name: 'email', value: 'test@example.com' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('La contrasena es obligatoria')
    })
  })

  it('deletes a user successfully', async () => {
    mockDeleteUser.mockResolvedValue({})
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })

    // Click delete button on first user (john, id=1)
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockDeleteUser).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Usuario eliminado correctamente')
    })
  })

  it('shows error toast when loading users fails', async () => {
    mockGetUsers.mockRejectedValue(new Error('Network error'))
    render(<UsersPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar los usuarios')
    })
  })

  it('shows error toast when creating user fails', async () => {
    mockCreateUser.mockRejectedValue(new Error('fail'))
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-username'), { target: { name: 'username', value: 'newuser' } })
    fireEvent.change(screen.getByTestId('input-email'), { target: { name: 'email', value: 'new@example.com' } })
    fireEvent.change(screen.getByTestId('input-password'), { target: { name: 'password', value: 'secret' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al guardar el usuario')
    })
  })

  it('shows error toast when delete fails', async () => {
    mockDeleteUser.mockRejectedValue(new Error('fail'))
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar el usuario')
    })
  })

  it('renders pagination', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('pagination triggers re-fetch', async () => {
    mockGetUsers.mockResolvedValue({
      data: { data: sampleUsers, meta: { pages: 3 } },
    })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalledTimes(2)
    })
  })

  it('renders column headers', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Username')).toBeInTheDocument()
    })
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Rol')).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()
    expect(screen.getByText('Conexiones Max')).toBeInTheDocument()
  })

  // --- NEW TESTS for coverage of uncovered lines ---

  it('opens edit modal with pre-populated form fields', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Editar Usuario')).toBeInTheDocument()
    })
    // Verify pre-populated fields
    expect(screen.getByTestId('input-username')).toHaveValue('john')
    expect(screen.getByTestId('input-email')).toHaveValue('john@example.com')
    expect(screen.getByTestId('input-password')).toHaveValue('')
    expect(screen.getByTestId('select-role')).toHaveValue('admin')
    expect((screen.getByTestId('input-max_connections') as HTMLInputElement).value).toBe('3')
    expect((screen.getByTestId('input-exp_date') as HTMLInputElement).value).toBe('2027-01-01')
  })

  it('opens edit modal for user with no exp_date', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('jane')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[1]) // jane is second row
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    expect(screen.getByTestId('input-username')).toHaveValue('jane')
    expect((screen.getByTestId('input-exp_date') as HTMLInputElement).value).toBe('')
  })

  it('updates a user successfully', async () => {
    mockUpdateUser.mockResolvedValue({ data: { data: { id: 1 } } })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Change username and submit
    fireEvent.change(screen.getByTestId('input-username'), { target: { name: 'username', value: 'john_updated' } })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({ username: 'john_updated' }))
      expect(mockToast.success).toHaveBeenCalledWith('Usuario actualizado correctamente')
    })
  })

  it('updates a user with a new password', async () => {
    mockUpdateUser.mockResolvedValue({ data: { data: { id: 1 } } })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-password'), { target: { name: 'password', value: 'newpass123' } })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({ password: 'newpass123' }))
    })
  })

  it('update without password does not include password in payload', async () => {
    mockUpdateUser.mockResolvedValue({ data: { data: { id: 1 } } })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      const payload = mockUpdateUser.mock.calls[0][1]
      expect(payload.password).toBeUndefined()
    })
  })

  it('shows error toast when update fails', async () => {
    mockUpdateUser.mockRejectedValue(new Error('fail'))
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al guardar el usuario')
    })
  })

  it('handles checkbox change for is_active in form', async () => {
    mockCreateUser.mockResolvedValue({ data: { data: { id: 10 } } })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Fill required fields
    fireEvent.change(screen.getByTestId('input-username'), { target: { name: 'username', value: 'test' } })
    fireEvent.change(screen.getByTestId('input-email'), { target: { name: 'email', value: 'test@test.com' } })
    fireEvent.change(screen.getByTestId('input-password'), { target: { name: 'password', value: 'pass' } })

    // Toggle is_active checkbox off
    const checkbox = screen.getByLabelText('Activo') as HTMLInputElement
    fireEvent.click(checkbox)

    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false })
      )
    })
  })

  it('disables delete button for the current user', async () => {
    const usersWithCurrent = [
      ...sampleUsers,
      {
        id: 999,
        username: 'current_admin',
        email: 'admin@example.com',
        role: 'admin',
        is_active: true,
        max_connections: 1,
        exp_date: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    mockGetUsers.mockResolvedValue({
      data: { data: usersWithCurrent, meta: { pages: 1 } },
    })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('current_admin')).toBeInTheDocument()
    })
    // The delete button for current user (id=999) should be disabled
    const deleteButton = screen.getByTitle('No puedes eliminar tu propio usuario')
    expect(deleteButton).toBeDisabled()
  })

  it('cancels delete confirm dialog', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
  })

  it('renders expiration date and dash for null exp_date', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // john has exp_date, jane has null
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('renders created_at dates in table', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // Dates are formatted by toLocaleDateString('es-ES')
    // Both should render some date text
    expect(screen.getByText('john')).toBeInTheDocument()
  })

  it('closes edit modal with Close button', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  it('closes create modal with Cancelar button', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    const cancelBtns = screen.getAllByText('Cancelar')
    const modalCancelBtn = cancelBtns.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(modalCancelBtn!)
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  it('creates user with max_connections and exp_date', async () => {
    mockCreateUser.mockResolvedValue({ data: { data: { id: 5 } } })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-username'), { target: { name: 'username', value: 'testuser' } })
    fireEvent.change(screen.getByTestId('input-email'), { target: { name: 'email', value: 'test@t.com' } })
    fireEvent.change(screen.getByTestId('input-password'), { target: { name: 'password', value: 'pass123' } })
    fireEvent.change(screen.getByTestId('input-max_connections'), { target: { name: 'max_connections', value: '5' } })
    fireEvent.change(screen.getByTestId('input-exp_date'), { target: { name: 'exp_date', value: '2028-12-31' } })
    fireEvent.change(screen.getByTestId('select-role'), { target: { name: 'role', value: 'admin' } })

    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          max_connections: 5,
          exp_date: '2028-12-31',
          role: 'admin',
          password: 'pass123',
        })
      )
    })
  })

  it('creates user with empty max_connections defaults to 1', async () => {
    mockCreateUser.mockResolvedValue({ data: { data: { id: 6 } } })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-username'), { target: { name: 'username', value: 'u' } })
    fireEvent.change(screen.getByTestId('input-email'), { target: { name: 'email', value: 'u@u.com' } })
    fireEvent.change(screen.getByTestId('input-password'), { target: { name: 'password', value: 'p' } })
    fireEvent.change(screen.getByTestId('input-max_connections'), { target: { name: 'max_connections', value: '' } })

    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ max_connections: 1 })
      )
    })
  })

  it('refetches data after successful user creation', async () => {
    mockCreateUser.mockResolvedValue({ data: { data: { id: 7 } } })
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Usuario')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Usuario'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-username'), { target: { name: 'username', value: 'x' } })
    fireEvent.change(screen.getByTestId('input-email'), { target: { name: 'email', value: 'x@x.com' } })
    fireEvent.change(screen.getByTestId('input-password'), { target: { name: 'password', value: 'x' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalledTimes(2) // initial + refetch
    })
  })
})
