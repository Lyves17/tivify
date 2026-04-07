import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CategoriesPage from '@/app/admin/categories/page'

jest.mock('@/lib/api')
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))
jest.mock('@/components/ui/loading-spinner', () => {
  return function MockLoadingSpinner({ text }: { text?: string }) {
    return <div data-testid="loading-spinner">{text || 'Loading...'}</div>
  }
})
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

import { adminAPI } from '@/lib/api'

const mockGetCategories = adminAPI.getCategories as jest.Mock
const mockCreateCategory = adminAPI.createCategory as jest.Mock
const mockUpdateCategory = adminAPI.updateCategory as jest.Mock
const mockDeleteCategory = adminAPI.deleteCategory as jest.Mock

const sampleCategories = [
  { id: 1, name: 'Action', slug: 'action', type: 'live', sort_order: 1, parent_id: null },
  { id: 2, name: 'Drama', slug: 'drama', type: 'vod', sort_order: 2, parent_id: null },
  { id: 3, name: 'Comedy', slug: 'comedy', type: 'series', sort_order: 3, parent_id: null },
]

describe('CategoriesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCategories.mockResolvedValue({
      data: { data: sampleCategories, meta: { pages: 1 } },
    })
  })

  it('renders page title', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Categorias')).toBeInTheDocument()
    })
  })

  it('renders data table with categories', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Comedy')).toBeInTheDocument()
  })

  it('renders type badges for categories', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      // Both filter buttons and table badges render LIVE/VOD/SERIES
      const liveElements = screen.getAllByText('LIVE')
      expect(liveElements.length).toBeGreaterThanOrEqual(2) // filter button + table badge
    })
    const vodElements = screen.getAllByText('VOD')
    expect(vodElements.length).toBeGreaterThanOrEqual(2)
    const seriesElements = screen.getAllByText('SERIES')
    expect(seriesElements.length).toBeGreaterThanOrEqual(2)
  })

  it('shows loading state', () => {
    mockGetCategories.mockImplementation(() => new Promise(() => {}))
    render(<CategoriesPage />)
    expect(screen.getByTestId('data-table-loading')).toBeInTheDocument()
  })

  it('shows empty state when no categories', async () => {
    mockGetCategories.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('No hay categorias')).toBeInTheDocument()
    })
  })

  it('renders "Nueva Categoria" button', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
  })

  it('opens create modal when clicking "Nueva Categoria"', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nueva Categoria'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Nueva Categoria', { selector: 'h2' })).toBeInTheDocument()
    })
  })

  it('opens edit modal when clicking "Editar" button', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Editar Categoria')).toBeInTheDocument()
    })
  })

  it('opens delete confirm when clicking "Eliminar" button', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      expect(screen.getByText('Eliminar Categoria')).toBeInTheDocument()
    })
  })

  it('creates a new category successfully', async () => {
    mockCreateCategory.mockResolvedValue({ data: { data: { id: 4 } } })
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nueva Categoria'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'New Category' } })
    fireEvent.change(screen.getByTestId('select-type'), { target: { name: 'type', value: 'vod' } })

    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Categoria creada')
    })
  })

  it('shows validation error when name is empty on submit', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nueva Categoria'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El nombre es obligatorio')
    })
  })

  it('deletes a category successfully', async () => {
    mockDeleteCategory.mockResolvedValue({})
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockDeleteCategory).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Categoria eliminada')
    })
  })

  it('shows error toast when loading categories fails', async () => {
    mockGetCategories.mockRejectedValue(new Error('Network error'))
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar categorias')
    })
  })

  it('shows error toast when delete fails', async () => {
    mockDeleteCategory.mockRejectedValue(new Error('fail'))
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar categoria')
    })
  })

  it('renders filter type buttons', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Todos')).toBeInTheDocument()
    })
    // Filter buttons exist (also table badges exist with same text)
    expect(screen.getAllByText('LIVE').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('VOD').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('SERIES').length).toBeGreaterThanOrEqual(1)
  })

  it('filters categories by type when filter button clicked', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument()
    })

    // Click on the VOD filter button - find the one that's a filter button (not in table)
    const vodFilterButtons = screen.getAllByText('VOD')
    // The filter button is the first one (in the filter bar)
    fireEvent.click(vodFilterButtons[0])

    await waitFor(() => {
      // Should re-fetch with filter
      expect(mockGetCategories).toHaveBeenCalledTimes(3) // initial + allCategories + filter
    })
  })

  it('renders pagination', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('shows error toast when create fails', async () => {
    mockCreateCategory.mockRejectedValue(new Error('fail'))
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nueva Categoria'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'New Cat' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al crear categoria')
    })
  })

  it('updates an existing category successfully', async () => {
    mockUpdateCategory.mockResolvedValue({ data: { data: { id: 1 } } })
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Editar Categoria')).toBeInTheDocument()
    })
    // Verify form is populated
    expect(screen.getByTestId('input-name')).toHaveValue('Action')
    expect(screen.getByTestId('select-type')).toHaveValue('live')

    // Change name and submit
    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Action Updated' } })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockUpdateCategory).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Action Updated' }))
      expect(mockToast.success).toHaveBeenCalledWith('Categoria actualizada')
    })
  })

  it('shows error toast when update fails', async () => {
    mockUpdateCategory.mockRejectedValue(new Error('fail'))
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al actualizar categoria')
    })
  })

  it('closes modal via cancel button', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nueva Categoria'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancelar'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  it('closes modal via Close button', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nueva Categoria'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  it('cancels delete confirm dialog', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
  })

  it('submits category with parent_id set', async () => {
    mockCreateCategory.mockResolvedValue({ data: { data: { id: 5 } } })
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nueva Categoria'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Sub Category' } })
    fireEvent.change(screen.getByTestId('select-parent_id'), { target: { name: 'parent_id', value: '1' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Sub Category',
        parent_id: 1,
      }))
    })
  })

  it('changes sort_order as a number', async () => {
    mockCreateCategory.mockResolvedValue({ data: { data: { id: 6 } } })
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nueva Categoria'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Ordered Cat' } })
    fireEvent.change(screen.getByTestId('input-sort_order'), { target: { name: 'sort_order', value: '5' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith(expect.objectContaining({
        sort_order: 5,
      }))
    })
  })

  it('shows validation error when type is empty', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Nueva Categoria')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nueva Categoria'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Test' } })
    // Set type to empty to trigger the validation
    fireEvent.change(screen.getByTestId('select-type'), { target: { name: 'type', value: '' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El tipo es obligatorio')
    })
  })

  it('renders sort_order in the table', async () => {
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('logs error when fetchAllCategories fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    // First call succeeds (fetchCategories), second call fails (fetchAllCategories)
    mockGetCategories
      .mockResolvedValueOnce({ data: { data: sampleCategories, meta: { pages: 1 } } })
      .mockRejectedValueOnce(new Error('fetch all error'))
    render(<CategoriesPage />)
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch all categories for parent list:',
        expect.any(Error)
      )
    })
    consoleSpy.mockRestore()
  })
})
