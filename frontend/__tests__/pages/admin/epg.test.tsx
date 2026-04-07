import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EPGPage from '@/app/admin/epg/page'

jest.mock('@/lib/api')
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
jest.mock('@/components/ui/form-textarea', () => {
  return function MockFormTextarea({ label, name, value, onChange, ...rest }: any) {
    return (
      <div>
        <label>{label}</label>
        <textarea name={name} value={value} onChange={onChange} data-testid={`textarea-${name}`} {...rest} />
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

const mockGetEPG = adminAPI.getEPG as jest.Mock
const mockGetChannels = adminAPI.getChannels as jest.Mock
const mockCreateEPG = adminAPI.createEPG as jest.Mock
const mockUpdateEPG = adminAPI.updateEPG as jest.Mock
const mockDeleteEPG = adminAPI.deleteEPG as jest.Mock

const sampleEPG = [
  {
    id: 1,
    channel_id: 10,
    channel_name: 'Channel One',
    title: 'Morning News',
    description: 'Daily news broadcast',
    start_time: '2026-03-14T08:00:00Z',
    end_time: '2026-03-14T09:00:00Z',
    category: 'News',
    language: 'es',
    episode_num: 'S01E01',
  },
  {
    id: 2,
    channel_id: 11,
    channel_name: 'Channel Two',
    title: 'Sports Show',
    description: '',
    start_time: '2026-03-14T20:00:00Z',
    end_time: '2026-03-14T22:00:00Z',
    category: 'Sports',
    language: 'en',
    episode_num: '',
  },
]

const sampleChannels = [
  { id: 10, name: 'Channel One' },
  { id: 11, name: 'Channel Two' },
]

describe('EPGPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetEPG.mockResolvedValue({
      data: { data: sampleEPG, meta: { pages: 1 } },
    })
    mockGetChannels.mockResolvedValue({
      data: { data: sampleChannels, meta: { pages: 1 } },
    })
  })

  it('renders page title', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Guia EPG')).toBeInTheDocument()
    })
  })

  it('renders EPG entries in data table', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Morning News')).toBeInTheDocument()
    expect(screen.getByText('Sports Show')).toBeInTheDocument()
  })

  it('renders channel names in table', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Channel One')).toBeInTheDocument()
    })
    expect(screen.getByText('Channel Two')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockGetEPG.mockImplementation(() => new Promise(() => {}))
    render(<EPGPage />)
    expect(screen.getByTestId('data-table-loading')).toBeInTheDocument()
  })

  it('shows empty state when no EPG entries', async () => {
    mockGetEPG.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('No hay entradas EPG disponibles')).toBeInTheDocument()
    })
  })

  it('renders "Crear Entrada" button', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Entrada')).toBeInTheDocument()
    })
  })

  it('opens create modal when clicking "Crear Entrada"', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Entrada')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Entrada'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Crear Entrada EPG')).toBeInTheDocument()
    })
  })

  it('creates a new EPG entry successfully', async () => {
    mockCreateEPG.mockResolvedValue({ data: { data: { id: 3 } } })
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Entrada')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Entrada'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('select-channel_id'), { target: { name: 'channel_id', value: '10' } })
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'New Program' } })

    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockCreateEPG).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Entrada EPG creada correctamente')
    })
  })

  it('shows validation error when channel is not selected', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Entrada')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Entrada'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El canal es obligatorio')
    })
  })

  it('shows validation error when title is empty', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Entrada')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Entrada'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('select-channel_id'), { target: { name: 'channel_id', value: '10' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El titulo es obligatorio')
    })
  })

  it('opens delete confirm dialog', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Morning News')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      expect(screen.getByText('Eliminar Entrada EPG')).toBeInTheDocument()
    })
  })

  it('deletes an EPG entry successfully', async () => {
    mockDeleteEPG.mockResolvedValue({})
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Morning News')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockDeleteEPG).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Entrada EPG eliminada correctamente')
    })
  })

  it('shows error toast when loading EPG fails', async () => {
    mockGetEPG.mockRejectedValue(new Error('Network error'))
    render(<EPGPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar la guia EPG')
    })
  })

  it('shows error toast when save fails', async () => {
    mockCreateEPG.mockRejectedValue(new Error('fail'))
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Entrada')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Entrada'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('select-channel_id'), { target: { name: 'channel_id', value: '10' } })
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Test' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al guardar la entrada EPG')
    })
  })

  it('shows error toast when delete fails', async () => {
    mockDeleteEPG.mockRejectedValue(new Error('fail'))
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Morning News')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar la entrada EPG')
    })
  })

  it('renders pagination', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('renders column headers', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Canal')).toBeInTheDocument()
    })
    expect(screen.getByText('Titulo')).toBeInTheDocument()
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByText('Fin')).toBeInTheDocument()
  })

  it('opens edit modal and populates form with existing EPG data', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Morning News')).toBeInTheDocument()
    })
    // Click "Editar" button on first row
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Editar Entrada EPG')).toBeInTheDocument()
    })
    // Verify form is populated with existing data
    expect(screen.getByTestId('select-channel_id')).toHaveValue('10')
    expect(screen.getByTestId('input-title')).toHaveValue('Morning News')
    expect(screen.getByTestId('textarea-description')).toHaveValue('Daily news broadcast')
    expect(screen.getByTestId('input-category')).toHaveValue('News')
    expect(screen.getByTestId('input-language')).toHaveValue('es')
    expect(screen.getByTestId('input-episode_num')).toHaveValue('S01E01')
  })

  it('submits update for an existing EPG entry', async () => {
    mockUpdateEPG.mockResolvedValue({ data: { data: { id: 1 } } })
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Morning News')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Change title and submit
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Updated News' } })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockUpdateEPG).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Updated News' }))
      expect(mockToast.success).toHaveBeenCalledWith('Entrada EPG actualizada correctamente')
    })
  })

  it('closes modal via cancel button', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Entrada')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Entrada'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancelar'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  it('closes modal via Close button', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Entrada')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Entrada'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  it('cancels delete confirm dialog', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Morning News')).toBeInTheDocument()
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

  it('logs error when fetching channels fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGetChannels.mockRejectedValue(new Error('channel fetch error'))
    render(<EPGPage />)
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch channels for EPG:', expect.any(Error))
    })
    consoleSpy.mockRestore()
  })

  it('renders channel name from channels list when channel_name is missing', async () => {
    const epgWithoutChannelName = [
      {
        id: 5,
        channel_id: 10,
        channel_name: '',
        title: 'Orphan Show',
        description: '',
        start_time: '',
        end_time: '',
        category: '',
        language: '',
        episode_num: '',
      },
    ]
    mockGetEPG.mockResolvedValue({
      data: { data: epgWithoutChannelName, meta: { pages: 1 } },
    })
    render(<EPGPage />)
    await waitFor(() => {
      // Should fall back to channels list lookup and find "Channel One" for channel_id 10
      expect(screen.getByText('Channel One')).toBeInTheDocument()
    })
  })

  it('renders dash for missing start_time and end_time', async () => {
    const epgNoTimes = [
      {
        id: 6,
        channel_id: 10,
        channel_name: 'Channel One',
        title: 'No Times Show',
        description: '',
        start_time: '',
        end_time: '',
        category: '',
        language: '',
        episode_num: '',
      },
    ]
    mockGetEPG.mockResolvedValue({
      data: { data: epgNoTimes, meta: { pages: 1 } },
    })
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('No Times Show')).toBeInTheDocument()
    })
    // The render functions return "—" for missing times
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('handles form input change for all fields', async () => {
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Entrada')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Entrada'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('textarea-description'), { target: { name: 'description', value: 'Test desc' } })
    fireEvent.change(screen.getByTestId('input-category'), { target: { name: 'category', value: 'Drama' } })
    fireEvent.change(screen.getByTestId('input-language'), { target: { name: 'language', value: 'en' } })
    fireEvent.change(screen.getByTestId('input-episode_num'), { target: { name: 'episode_num', value: 'S02E05' } })

    expect(screen.getByTestId('textarea-description')).toHaveValue('Test desc')
    expect(screen.getByTestId('input-category')).toHaveValue('Drama')
    expect(screen.getByTestId('input-language')).toHaveValue('en')
    expect(screen.getByTestId('input-episode_num')).toHaveValue('S02E05')
  })

  it('paginates to next page', async () => {
    mockGetEPG.mockResolvedValue({
      data: { data: sampleEPG, meta: { pages: 3 } },
    })
    render(<EPGPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => {
      expect(mockGetEPG).toHaveBeenCalledTimes(2)
    })
  })
})
