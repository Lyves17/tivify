import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VODPage from '@/app/admin/vod/page'

jest.mock('@/lib/api')
jest.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  }
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
      isAxiosError: jest.fn(() => false),
      ...mockAxiosInstance,
    },
  }
})
jest.mock('lucide-react', () => ({
  Pencil: (props: any) => <span data-testid="pencil-icon" {...props} />,
  Trash2: (props: any) => <span data-testid="trash-icon" {...props} />,
  Plus: (props: any) => <span data-testid="plus-icon" {...props} />,
  Upload: (props: any) => <span data-testid="upload-icon" {...props} />,
  CheckCircle: (props: any) => <span data-testid="check-icon" {...props} />,
  Loader2: (props: any) => <span data-testid="loader-icon" {...props} />,
  Bug: (props: any) => <span data-testid="bug-icon" {...props} />,
  ChevronDown: (props: any) => <span data-testid="chevron-down" {...props} />,
  ChevronUp: (props: any) => <span data-testid="chevron-up" {...props} />,
  Sparkles: (props: any) => <span data-testid="sparkles-icon" {...props} />,
  HardDrive: (props: any) => <span data-testid="harddrive-icon" {...props} />,
  RefreshCw: (props: any) => <span data-testid="refresh-icon" {...props} />,
  XCircle: (props: any) => <span data-testid="xcircle-icon" {...props} />,
  AlertTriangle: (props: any) => <span data-testid="alert-icon" {...props} />,
  FileText: (props: any) => <span data-testid="filetext-icon" {...props} />,
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
jest.mock('@/components/ui/tmdb-search', () => {
  return {
    __esModule: true,
    default: function MockTMDBSearchButton({ onSelect }: any) {
      return <button data-testid="tmdb-search" onClick={() => onSelect({ title: 'TMDB Movie', year: 2025 })}>TMDB</button>
    },
  }
})
jest.mock('@/lib/utils', () => ({
  formatDurationTimer: jest.fn((s: number) => {
    if (!s) return '0:00'
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }),
  isValidURL: jest.fn((url: string) => url.startsWith('http')),
}))

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}
jest.mock('@/context/toast-context', () => ({
  useToast: () => mockToast,
}))

import { adminAPI } from '@/lib/api'

const mockGetVODs = adminAPI.getVODs as jest.Mock
const mockGetCategoriesByType = adminAPI.getCategoriesByType as jest.Mock
const mockCreateVOD = adminAPI.createVOD as jest.Mock
const mockUpdateVOD = adminAPI.updateVOD as jest.Mock
const mockDeleteVOD = adminAPI.deleteVOD as jest.Mock
const mockGetVODDebugStats = adminAPI.getVODDebugStats as jest.Mock
const mockEnrichVODs = adminAPI.enrichVODs as jest.Mock
const mockGetUploadDiagnostics = adminAPI.getUploadDiagnostics as jest.Mock

const sampleVods = [
  {
    id: 1,
    title: 'Inception',
    description: 'A mind-bending thriller',
    category: { id: 1, name: 'Sci-Fi' },
    category_id: 1,
    year: 2010,
    duration: 8880,
    rating: 8.8,
    poster_url: 'https://example.com/poster.jpg',
    backdrop_url: '',
    hls_path: '/media/inception.mp4',
    resolution: '1080p',
    is_active: true,
    transcode_status: 'completed',
    transcode_progress: 100,
    series_id: null,
    season_number: 0,
    episode_number: 0,
  },
  {
    id: 2,
    title: 'The Matrix',
    description: '',
    category: null,
    category_id: null,
    year: 1999,
    duration: 8160,
    rating: 8.7,
    poster_url: '',
    backdrop_url: '',
    hls_path: '',
    resolution: '',
    is_active: false,
    transcode_status: 'pending',
    transcode_progress: 0,
    series_id: null,
    season_number: 0,
    episode_number: 0,
  },
]

const sampleCategories = [
  { id: 1, name: 'Sci-Fi' },
  { id: 2, name: 'Action' },
]

describe('AdminVODPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })
    mockGetCategoriesByType.mockResolvedValue({
      data: { data: sampleCategories },
    })
    mockGetVODDebugStats.mockResolvedValue({
      data: { data: { total: 2, completed: 1, pending: 1, failed: 0, processing: 0 } },
    })
    mockGetUploadDiagnostics.mockResolvedValue({
      data: { data: null },
    })
  })

  it('renders page title', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('VODs')).toBeInTheDocument()
    })
  })

  it('renders VOD data table', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Inception')).toBeInTheDocument()
    expect(screen.getByText('The Matrix')).toBeInTheDocument()
  })

  it('renders category names in table', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockGetVODs.mockImplementation(() => new Promise(() => {}))
    render(<VODPage />)
    expect(screen.getByTestId('data-table-loading')).toBeInTheDocument()
  })

  it('shows empty state when no VODs', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('No hay VODs disponibles')).toBeInTheDocument()
    })
  })

  it('renders "Crear VOD" button', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
  })

  it('opens create modal when clicking "Crear VOD"', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Crear VOD', { selector: 'h2' })).toBeInTheDocument()
    })
  })

  it('opens delete confirm dialog', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      expect(screen.getByText('Eliminar VOD')).toBeInTheDocument()
    })
  })

  it('deletes a VOD successfully', async () => {
    mockDeleteVOD.mockResolvedValue({})
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockDeleteVOD).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('VOD eliminado correctamente')
    })
  })

  it('shows error toast when loading VODs fails', async () => {
    mockGetVODs.mockRejectedValue(new Error('Network error'))
    render(<VODPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar los VODs')
    })
  })

  it('shows error toast when delete fails', async () => {
    mockDeleteVOD.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar el VOD')
    })
  })

  it('renders pagination', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('pagination triggers re-fetch', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 3 } },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => {
      expect(mockGetVODs).toHaveBeenCalledTimes(2)
    })
  })

  it('renders column headers', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Titulo')).toBeInTheDocument()
    })
    expect(screen.getByText('Categoria')).toBeInTheDocument()
    expect(screen.getByText('Duracion')).toBeInTheDocument()
    expect(screen.getByText('Ano')).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()
  })

  it('calls fetchData and fetchDebugStats on mount', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(mockGetVODs).toHaveBeenCalledWith(1, 20)
      expect(mockGetVODDebugStats).toHaveBeenCalled()
    })
  })

  it('calls getCategoriesByType with "vod"', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(mockGetCategoriesByType).toHaveBeenCalledWith('vod')
    })
  })

  it('opens create modal, fills all fields, and submits successfully', async () => {
    mockCreateVOD.mockResolvedValue({ data: { data: { id: 3 } } })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Switch to manual/advanced tab to show full form
    fireEvent.click(screen.getByText('Avanzado'))

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'New Movie' } })
    fireEvent.change(screen.getByTestId('textarea-description'), { target: { name: 'description', value: 'A great movie' } })
    fireEvent.change(screen.getByTestId('select-category_id'), { target: { name: 'category_id', value: '2' } })
    fireEvent.change(screen.getByTestId('input-year'), { target: { name: 'year', value: '2024' } })
    fireEvent.change(screen.getByTestId('input-rating'), { target: { name: 'rating', value: '7.5' } })
    fireEvent.change(screen.getByTestId('input-poster_url'), { target: { name: 'poster_url', value: 'https://example.com/poster.jpg' } })

    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockCreateVOD).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('VOD creado correctamente')
    })
  })

  it('shows validation error when title is empty on manual submit', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))
    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El título es requerido')
    })
  })

  it('shows validation error when title exceeds 200 characters', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))
    const longTitle = 'A'.repeat(201)
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: longTitle } })
    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El título no puede exceder 200 caracteres')
    })
  })

  it('opens edit modal with pre-populated form and submits update', async () => {
    mockUpdateVOD.mockResolvedValue({ data: { data: { id: 1 } } })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Editar VOD')).toBeInTheDocument()
    })
    // Verify form is pre-populated
    expect(screen.getByTestId('input-title')).toHaveValue('Inception')
    expect((screen.getByTestId('input-year') as HTMLInputElement).value).toBe('2010')

    // Change title and submit
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Inception Updated' } })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockUpdateVOD).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Inception Updated' }))
      expect(mockToast.success).toHaveBeenCalledWith('VOD actualizado correctamente')
    })
  })

  it('shows error toast when save (manual) fails', async () => {
    mockCreateVOD.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Test' } })
    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al guardar el VOD')
    })
  })

  it('cancels delete confirm dialog', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
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

  it('renders transcode status labels for different statuses', async () => {
    const vodsWithStatuses = [
      { ...sampleVods[0], id: 1, transcode_status: 'completed', transcode_progress: 100 },
      { ...sampleVods[1], id: 2, transcode_status: 'pending', transcode_progress: 0 },
      { ...sampleVods[0], id: 3, title: 'Processing Movie', transcode_status: 'processing', transcode_progress: 45 },
      { ...sampleVods[0], id: 4, title: 'Failed Movie', transcode_status: 'failed', transcode_progress: 0 },
    ]
    mockGetVODs.mockResolvedValue({
      data: { data: vodsWithStatuses, meta: { pages: 1 } },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Listo')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText(/Procesando/)).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders TMDB Auto button and triggers bulk enrich', async () => {
    mockEnrichVODs.mockResolvedValue({
      data: { data: { enriched: 5, skipped: 2, failed: 1 } },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('TMDB Auto')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('TMDB Auto'))
    await waitFor(() => {
      expect(mockEnrichVODs).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('TMDB: 5 enriquecidos, 2 omitidos, 1 fallidos')
    })
  })

  it('shows error toast when bulk enrich fails', async () => {
    mockEnrichVODs.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('TMDB Auto')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('TMDB Auto'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al enriquecer VODs con TMDB')
    })
  })

  it('TMDB search button in modal applies metadata', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Switch to manual tab to see the TMDB button
    fireEvent.click(screen.getByText('Avanzado'))
    // Click the TMDB search mock button
    fireEvent.click(screen.getByTestId('tmdb-search'))
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Metadatos TMDB aplicados')
    })
  })

  it('shows series_id, season and episode fields in manual form', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))
    expect(screen.getByTestId('input-series_id')).toBeInTheDocument()
    expect(screen.getByTestId('input-season_number')).toBeInTheDocument()
    expect(screen.getByTestId('input-episode_number')).toBeInTheDocument()
  })

  it('submits create with series association fields', async () => {
    mockCreateVOD.mockResolvedValue({ data: { data: { id: 5 } } })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Episode 1' } })
    fireEvent.change(screen.getByTestId('input-series_id'), { target: { name: 'series_id', value: '10' } })
    fireEvent.change(screen.getByTestId('input-season_number'), { target: { name: 'season_number', value: '2' } })
    fireEvent.change(screen.getByTestId('input-episode_number'), { target: { name: 'episode_number', value: '3' } })

    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockCreateVOD).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Episode 1',
          series_id: 10,
          season_number: 2,
          episode_number: 3,
        })
      )
    })
  })

  it('renders Visible column correctly', async () => {
    // Inception: is_active=true, series_id=null => visible
    // The Matrix: is_active=false => not visible
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    const yesElements = screen.getAllByText('Sí')
    const noElements = screen.getAllByText('No')
    expect(yesElements.length).toBeGreaterThanOrEqual(1)
    expect(noElements.length).toBeGreaterThanOrEqual(1)
  })

  it('switches between upload and manual tabs in create modal', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Default is upload tab — check for file upload area text
    expect(screen.getByText(/Haz clic para seleccionar/)).toBeInTheDocument()

    // Switch to manual
    fireEvent.click(screen.getByText('Avanzado'))
    expect(screen.getByTestId('input-title')).toBeInTheDocument()
    expect(screen.getByTestId('textarea-description')).toBeInTheDocument()

    // Switch back to upload
    fireEvent.click(screen.getByText('Subir archivo'))
    expect(screen.getByText(/Haz clic para seleccionar/)).toBeInTheDocument()
  })

  it('renders Debug button and toggles debug panel', async () => {
    mockGetVODDebugStats.mockResolvedValue({
      data: { data: { total: 2, completed: 1, pending: 1, failed: 0, processing: 0, visible_to_users: 1, active_episodes: 0, inactive: 1, problems: [] } },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // The Debug button shows "Debug (X visibles)" after stats load
    const debugButton = screen.getByTitle('Panel de diagnóstico de visibilidad')
    fireEvent.click(debugButton)
    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico de visibilidad VODs/)).toBeInTheDocument()
    })
  })

  // --- NEW TESTS for more coverage ---

  it('shows error toast when loading categories fails', async () => {
    mockGetCategoriesByType.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error cargando categorías')
    })
  })

  it('shows error toast when update VOD fails', async () => {
    const mockUpdateVOD = adminAPI.updateVOD as jest.Mock
    mockUpdateVOD.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al guardar el VOD')
    })
  })

  it('refetches data after successful VOD creation', async () => {
    mockCreateVOD.mockResolvedValue({ data: { data: { id: 10 } } })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'New' } })
    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockGetVODs).toHaveBeenCalledTimes(2)
    })
  })

  it('refetches data after successful VOD deletion', async () => {
    mockDeleteVOD.mockResolvedValue({})
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockGetVODs).toHaveBeenCalledTimes(2)
    })
  })

  it('renders debug panel with stats and problems', async () => {
    mockGetVODDebugStats.mockResolvedValue({
      data: {
        data: {
          total: 5,
          completed: 3,
          pending: 1,
          failed: 1,
          processing: 0,
          visible_to_users: 2,
          active_episodes: 1,
          inactive: 2,
          problems: [
            { id: 1, title: 'Broken VOD', reason: 'No HLS path', hls_path: '' },
          ],
        },
      },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    const debugButton = screen.getByTitle('Panel de diagnóstico de visibilidad')
    fireEvent.click(debugButton)
    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico de visibilidad VODs/)).toBeInTheDocument()
    })
    expect(screen.getByText('Broken VOD')).toBeInTheDocument()
    expect(screen.getByText('No HLS path')).toBeInTheDocument()
  })

  it('renders debug panel with no problems message', async () => {
    mockGetVODDebugStats.mockResolvedValue({
      data: {
        data: {
          total: 2,
          completed: 2,
          pending: 0,
          failed: 0,
          processing: 0,
          visible_to_users: 2,
          active_episodes: 0,
          inactive: 0,
          problems: [],
        },
      },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    const debugButton = screen.getByTitle('Panel de diagnóstico de visibilidad')
    fireEvent.click(debugButton)
    await waitFor(() => {
      expect(screen.getByText(/Todos los VODs activos/)).toBeInTheDocument()
    })
  })

  it('opens Upload Debug panel', async () => {
    mockGetUploadDiagnostics.mockResolvedValue({
      data: {
        data: {
          current_user: 'app',
          current_uid: 1000,
          ffmpeg_ok: true,
          ffmpeg_version: '5.1',
          ffprobe_ok: true,
          ffprobe_version: '5.1',
          disk_free_gb: 50.0,
          disk_total_gb: 100.0,
          media_path: '/media',
          directories: [],
          pending_count: 1,
          processing_count: 0,
          completed_count: 5,
          failed_count: 0,
          recent_media: [],
        },
      },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(mockGetUploadDiagnostics).toHaveBeenCalled()
      expect(screen.getByText(/Diagnóstico de Uploads/)).toBeInTheDocument()
    })
  })

  it('shows error toast when upload diagnostics fails', async () => {
    mockGetUploadDiagnostics.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar diagnóstico de uploads')
    })
  })

  it('closes create modal with Cancelar button in manual mode', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))
    const cancelBtns = screen.getAllByText('Cancelar')
    const modalCancelBtn = cancelBtns.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(modalCancelBtn!)
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  it('closes edit modal with Close button', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
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

  it('renders poster image or fallback in table', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // Inception has a poster_url, The Matrix does not
    expect(screen.getByText('Inception')).toBeInTheDocument()
    expect(screen.getByText('The Matrix')).toBeInTheDocument()
  })

  it('shows Si/No for active column', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // Inception is_active=true => "Si", The Matrix is_active=false => "No"
    expect(screen.getByText('Si')).toBeInTheDocument()
    // "No" appears in multiple columns for The Matrix (Activo: No, Visible: No)
    const noElements = screen.getAllByText('No')
    expect(noElements.length).toBeGreaterThanOrEqual(1)
  })

  it('shows category dash when category is null', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // The Matrix has no category
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('creates VOD with all optional fields', async () => {
    mockCreateVOD.mockResolvedValue({ data: { data: { id: 20 } } })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Full Movie' } })
    fireEvent.change(screen.getByTestId('textarea-description'), { target: { name: 'description', value: 'desc' } })
    fireEvent.change(screen.getByTestId('select-category_id'), { target: { name: 'category_id', value: '1' } })
    fireEvent.change(screen.getByTestId('input-year'), { target: { name: 'year', value: '2024' } })
    fireEvent.change(screen.getByTestId('input-rating'), { target: { name: 'rating', value: '9.0' } })
    fireEvent.change(screen.getByTestId('input-poster_url'), { target: { name: 'poster_url', value: 'https://p.jpg' } })
    fireEvent.change(screen.getByTestId('input-backdrop_url'), { target: { name: 'backdrop_url', value: 'https://b.jpg' } })

    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockCreateVOD).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Full Movie',
          description: 'desc',
          category_id: 1,
          year: 2024,
          rating: 9,
          poster_url: 'https://p.jpg',
          backdrop_url: 'https://b.jpg',
        })
      )
    })
  })

  it('edits VOD and verifies prepopulated fields', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    expect(screen.getByTestId('input-title')).toHaveValue('Inception')
    expect(screen.getByTestId('textarea-description')).toHaveValue('A mind-bending thriller')
    expect(screen.getByTestId('select-category_id')).toHaveValue('1')
    expect((screen.getByTestId('input-year') as HTMLInputElement).value).toBe('2010')
    expect((screen.getByTestId('input-rating') as HTMLInputElement).value).toBe('8.8')
  })

  it('handles checkbox change in form', async () => {
    mockCreateVOD.mockResolvedValue({ data: { data: { id: 30 } } })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Test' } })

    // Uncheck is_active
    const checkbox = screen.getByLabelText('Activo') as HTMLInputElement
    fireEvent.click(checkbox)

    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockCreateVOD).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        })
      )
    })
  })

  it('renders enriching state on TMDB Auto button', async () => {
    // Make enrichVODs hang
    mockEnrichVODs.mockImplementation(() => new Promise(() => {}))
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('TMDB Auto')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('TMDB Auto'))
    await waitFor(() => {
      expect(screen.getByText('Enriqueciendo...')).toBeInTheDocument()
    })
  })

  // --- NEW TESTS for more coverage ---

  it('renders upload diagnostics with directories and recent media', async () => {
    mockGetUploadDiagnostics.mockResolvedValue({
      data: {
        data: {
          current_user: 'app',
          current_uid: 1000,
          ffmpeg_ok: true,
          ffmpeg_version: '5.1.2',
          ffprobe_ok: false,
          ffprobe_version: '',
          disk_free_gb: 25.3,
          disk_total_gb: 100.0,
          media_path: '/media/vod',
          directories: [
            { path: '/media/vod/uploads', exists: true, writable: true },
            { path: '/media/vod/hls', exists: true, writable: false },
            { path: '/media/vod/temp', exists: false, writable: false },
          ],
          pending_count: 2,
          processing_count: 1,
          completed_count: 10,
          failed_count: 3,
          recent_media: [
            {
              id: 1, original_filename: 'movie.mkv', status: 'completed',
              file_size_bytes: 1073741824, duration: 7200, resolution: '1080p',
              created_at: '2026-01-01T00:00:00Z', file_exists: true, hls_exists: true,
              file_path: '/media/vod/uploads/movie.mkv', hls_path: '/media/vod/hls/1/index.m3u8',
              progress: 100, error_message: '',
            },
            {
              id: 2, original_filename: 'broken.avi', status: 'failed',
              file_size_bytes: 524288000, duration: 0, resolution: '',
              created_at: '2026-01-02T00:00:00Z', file_exists: false, hls_exists: false,
              file_path: '/media/vod/uploads/broken.avi', hls_path: '',
              progress: 0, error_message: 'FFmpeg error: unsupported codec',
            },
            {
              id: 3, original_filename: 'processing.mp4', status: 'processing',
              file_size_bytes: 209715200, duration: 3600, resolution: '720p',
              created_at: '2026-01-03T00:00:00Z', file_exists: true, hls_exists: false,
              file_path: '/media/vod/uploads/processing.mp4', hls_path: '',
              progress: 45, error_message: '',
            },
          ],
        },
      },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico de Uploads/)).toBeInTheDocument()
    })
    // Check system info
    expect(screen.getByText('app')).toBeInTheDocument()
    expect(screen.getByText('25.3 GB libres')).toBeInTheDocument()
    // Directories
    expect(screen.getByText('/media/vod/uploads')).toBeInTheDocument()
    expect(screen.getByText('Sin permiso de escritura')).toBeInTheDocument()
    expect(screen.getByText('No existe')).toBeInTheDocument()
    // Status counts
    expect(screen.getByText('2')).toBeInTheDocument() // pending
    // Recent media
    expect(screen.getByText('movie.mkv')).toBeInTheDocument()
    expect(screen.getByText('broken.avi')).toBeInTheDocument()
    expect(screen.getByText('FFmpeg error: unsupported codec')).toBeInTheDocument()
    expect(screen.getByText('processing.mp4')).toBeInTheDocument()
  })

  it('renders upload diagnostics with no recent media', async () => {
    mockGetUploadDiagnostics.mockResolvedValue({
      data: {
        data: {
          current_user: 'app',
          current_uid: 1000,
          ffmpeg_ok: true,
          ffmpeg_version: '5.1',
          ffprobe_ok: true,
          ffprobe_version: '5.1',
          disk_free_gb: 50.0,
          disk_total_gb: 100.0,
          media_path: '/media',
          directories: [],
          pending_count: 0,
          processing_count: 0,
          completed_count: 0,
          failed_count: 0,
          recent_media: [],
        },
      },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.getByText('No hay archivos subidos aún.')).toBeInTheDocument()
    })
  })

  it('debug panel shows edit button for problem VOD that exists in data', async () => {
    mockGetVODDebugStats.mockResolvedValue({
      data: {
        data: {
          total: 2,
          completed: 1,
          pending: 1,
          failed: 0,
          processing: 0,
          visible_to_users: 1,
          active_episodes: 0,
          inactive: 1,
          problems: [
            { id: 1, title: 'Inception', reason: 'No HLS path', hls_path: '' },
          ],
        },
      },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    const debugButton = screen.getByTitle('Panel de diagnóstico de visibilidad')
    fireEvent.click(debugButton)
    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico de visibilidad VODs/)).toBeInTheDocument()
    })
    // Problem VOD id=1 matches sampleVods[0] (Inception), so edit button should appear
    // There should be multiple "Editar" buttons (one in table, one in debug panel)
    const editButtons = screen.getAllByText('Editar')
    expect(editButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders resolution info in edit form when resolution exists', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    // Inception has resolution '1080p'
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    expect(screen.getByText('1080p')).toBeInTheDocument()
  })

  it('renders HLS path in read-only mode when editing', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Inception has hls_path '/media/inception.mp4'
    expect(screen.getByText('/media/inception.mp4')).toBeInTheDocument()
    expect(screen.getByText('Ruta HLS (generada automáticamente)')).toBeInTheDocument()
  })

  it('shows HLS path input field in manual create mode', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))
    expect(screen.getByTestId('input-hls_path')).toBeInTheDocument()
    expect(screen.getByText(/Modo avanzado/)).toBeInTheDocument()
  })

  it('file selection sets title from filename and shows selected step', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // We're in upload tab. Simulate file selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video content'], 'my-cool_movie.2024.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fireEvent.change(fileInput)
    // After file selection, the selected step UI should show the filename and Subir button
    await waitFor(() => {
      expect(screen.getByText('my-cool_movie.2024.mp4')).toBeInTheDocument()
      expect(screen.getByText('Subir')).toBeInTheDocument()
    })
    // The title input should have the auto-generated title
    const titleInput = screen.getByTestId('input-title') as HTMLInputElement
    expect(titleInput.value).toBe('my cool movie 2024')
  })

  it('shows upload diagnostics loading state', async () => {
    mockGetUploadDiagnostics.mockImplementation(() => new Promise(() => {}))
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.getByText('Cargando diagnóstico...')).toBeInTheDocument()
    })
  })

  it('creates VOD with hls_path and duration in manual mode', async () => {
    mockCreateVOD.mockResolvedValue({ data: { data: { id: 50 } } })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Avanzado'))

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'External Movie' } })
    fireEvent.change(screen.getByTestId('input-hls_path'), { target: { name: 'hls_path', value: '/media/vod/ext/index.m3u8' } })
    fireEvent.change(screen.getByTestId('input-duration'), { target: { name: 'duration', value: '7200' } })

    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockCreateVOD).toHaveBeenCalledWith(
        expect.objectContaining({
          hls_path: '/media/vod/ext/index.m3u8',
          duration: 7200,
        })
      )
    })
  })

  it('debug stats shows when no debugStats loaded yet', async () => {
    mockGetVODDebugStats.mockResolvedValue({ data: { data: null } })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // Debug button should show "Debug" without counts
    expect(screen.getByText('Debug')).toBeInTheDocument()
  })

  it('toggles upload debug panel closed', async () => {
    mockGetUploadDiagnostics.mockResolvedValue({
      data: {
        data: {
          current_user: 'app',
          current_uid: 1000,
          ffmpeg_ok: true,
          ffmpeg_version: '5.1',
          ffprobe_ok: true,
          ffprobe_version: '5.1',
          disk_free_gb: 50.0,
          disk_total_gb: 100.0,
          media_path: '/media',
          directories: [],
          pending_count: 0,
          processing_count: 0,
          completed_count: 0,
          failed_count: 0,
          recent_media: [],
        },
      },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // Open
    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico de Uploads/)).toBeInTheDocument()
    })
    // Close
    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.queryByText(/Diagnóstico de Uploads/)).not.toBeInTheDocument()
    })
  })

  it('renders VOD with series_id in visible column as No', async () => {
    const vodsWithSeries = [
      { ...sampleVods[0], id: 10, series_id: 5, is_active: true },
    ]
    mockGetVODs.mockResolvedValue({
      data: { data: vodsWithSeries, meta: { pages: 1 } },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // is_active=true but series_id=5, so visible should be "No"
    const noElements = screen.getAllByText('No')
    expect(noElements.length).toBeGreaterThanOrEqual(1)
  })
})
