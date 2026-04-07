import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SeriesPage from '@/app/admin/series/page'

jest.mock('@/lib/api')
jest.mock('lucide-react', () => ({
  Pencil: (props: any) => <span data-testid="pencil-icon" {...props} />,
  Trash2: (props: any) => <span data-testid="trash-icon" {...props} />,
  Plus: (props: any) => <span data-testid="plus-icon" {...props} />,
  Film: (props: any) => <span data-testid="film-icon" {...props} />,
  Upload: (props: any) => <span data-testid="upload-icon" {...props} />,
  CheckCircle: (props: any) => <span data-testid="check-icon" {...props} />,
  Loader2: (props: any) => <span data-testid="loader-icon" {...props} />,
  Sparkles: (props: any) => <span data-testid="sparkles-icon" {...props} />,
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
      return <button data-testid="tmdb-search" onClick={() => onSelect({ title: 'TMDB Series', year: 2025 })}>TMDB</button>
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

const mockGetSeries = adminAPI.getSeries as jest.Mock
const mockGetCategoriesByType = adminAPI.getCategoriesByType as jest.Mock
const mockCreateSeries = adminAPI.createSeries as jest.Mock
const mockUpdateSeries = adminAPI.updateSeries as jest.Mock
const mockDeleteSeries = adminAPI.deleteSeries as jest.Mock
const mockGetSeriesEpisodes = adminAPI.getSeriesEpisodes as jest.Mock
const mockEnrichSeries = adminAPI.enrichSeries as jest.Mock

const sampleSeries = [
  {
    id: 1,
    title: 'Breaking Bad',
    description: 'A chemistry teacher turned drug lord',
    category: { id: 1, name: 'Drama' },
    category_id: 1,
    year: 2008,
    rating: 9.5,
    total_seasons: 5,
    episodes_count: 62,
    poster_url: 'https://example.com/bb.jpg',
    backdrop_url: '',
    is_active: true,
  },
  {
    id: 2,
    title: 'The Office',
    description: '',
    category: { id: 2, name: 'Comedy' },
    category_id: 2,
    year: 2005,
    rating: 8.9,
    total_seasons: 9,
    episodes_count: 201,
    poster_url: '',
    backdrop_url: '',
    is_active: false,
  },
]

const sampleCategories = [
  { id: 1, name: 'Drama' },
  { id: 2, name: 'Comedy' },
]

describe('AdminSeriesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })
    mockGetCategoriesByType.mockResolvedValue({
      data: { data: sampleCategories },
    })
  })

  it('renders page title', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Series')).toBeInTheDocument()
    })
  })

  it('renders series data table', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    expect(screen.getByText('The Office')).toBeInTheDocument()
  })

  it('renders category names', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Comedy')).toBeInTheDocument()
  })

  it('renders active/inactive status badges', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Activo')).toBeInTheDocument()
    })
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockGetSeries.mockImplementation(() => new Promise(() => {}))
    render(<SeriesPage />)
    expect(screen.getByTestId('data-table-loading')).toBeInTheDocument()
  })

  it('shows empty state when no series', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('No hay series disponibles')).toBeInTheDocument()
    })
  })

  it('renders "Crear Serie" button', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Serie')).toBeInTheDocument()
    })
  })

  it('opens create modal when clicking "Crear Serie"', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Serie')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Crear Serie', { selector: 'h2' })).toBeInTheDocument()
    })
  })

  it('creates a series successfully', async () => {
    mockCreateSeries.mockResolvedValue({ data: { data: { id: 3 } } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Serie')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'New Series' } })

    // Click the create button (text "Crear" inside modal)
    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockCreateSeries).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Serie creada correctamente')
    })
  })

  it('shows validation error when title is empty', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Serie')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El título es requerido')
    })
  })

  it('shows validation error when title exceeds 200 characters', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Serie')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const longTitle = 'A'.repeat(201)
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: longTitle } })
    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El título no puede exceder 200 caracteres')
    })
  })

  it('opens delete confirm dialog', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      expect(screen.getByText('Eliminar Serie')).toBeInTheDocument()
    })
  })

  it('deletes a series successfully', async () => {
    mockDeleteSeries.mockResolvedValue({})
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockDeleteSeries).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Serie eliminada correctamente')
    })
  })

  it('opens episode manager modal', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    // The "Episodios" button is rendered by the actions column render
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      // The modal title contains an em-dash
      expect(screen.getByText(/Episodios.*Breaking Bad/)).toBeInTheDocument()
    })
  })

  it('shows error toast when loading series fails', async () => {
    mockGetSeries.mockRejectedValue(new Error('Network error'))
    render(<SeriesPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar las series')
    })
  })

  it('shows error toast when save fails', async () => {
    mockCreateSeries.mockRejectedValue(new Error('fail'))
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Serie')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Test' } })
    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al guardar la serie')
    })
  })

  it('shows error toast when delete fails', async () => {
    mockDeleteSeries.mockRejectedValue(new Error('fail'))
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar la serie')
    })
  })

  it('renders pagination', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('pagination triggers re-fetch', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 3 } },
    })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => {
      expect(mockGetSeries).toHaveBeenCalledTimes(2)
    })
  })

  it('renders column headers', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Titulo')).toBeInTheDocument()
    })
    expect(screen.getByText('Categoria')).toBeInTheDocument()
    expect(screen.getByText('Temporadas')).toBeInTheDocument()
    // "Episodios" appears both as column header and as action button text
    const episodiosElements = screen.getAllByText('Episodios')
    expect(episodiosElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Ano')).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()
  })

  it('renders TMDB Auto button', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('TMDB Auto')).toBeInTheDocument()
    })
  })

  it('triggers bulk enrich when clicking TMDB Auto', async () => {
    mockEnrichSeries.mockResolvedValue({
      data: { data: { enriched: 3, skipped: 1, failed: 0 } },
    })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('TMDB Auto')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('TMDB Auto'))
    await waitFor(() => {
      expect(mockEnrichSeries).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('TMDB: 3 enriquecidas, 1 omitidas, 0 fallidas')
    })
  })

  it('calls getCategoriesByType with "series"', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(mockGetCategoriesByType).toHaveBeenCalledWith('series')
    })
  })

  it('opens edit modal with pre-populated form and submits update', async () => {
    mockUpdateSeries.mockResolvedValue({ data: { data: { id: 1 } } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Editar Serie')).toBeInTheDocument()
    })
    // Verify form is pre-populated
    expect(screen.getByTestId('input-title')).toHaveValue('Breaking Bad')
    expect((screen.getByTestId('input-year') as HTMLInputElement).value).toBe('2008')
    expect((screen.getByTestId('input-rating') as HTMLInputElement).value).toBe('9.5')
    expect((screen.getByTestId('input-total_seasons') as HTMLInputElement).value).toBe('5')

    // Modify and submit
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Breaking Bad Updated' } })
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockUpdateSeries).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Breaking Bad Updated' }))
      expect(mockToast.success).toHaveBeenCalledWith('Serie actualizada correctamente')
    })
  })

  it('fills all fields in create modal and submits successfully', async () => {
    mockCreateSeries.mockResolvedValue({ data: { data: { id: 4 } } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Serie')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'New Series' } })
    fireEvent.change(screen.getByTestId('textarea-description'), { target: { name: 'description', value: 'A new show' } })
    fireEvent.change(screen.getByTestId('select-category_id'), { target: { name: 'category_id', value: '1' } })
    fireEvent.change(screen.getByTestId('input-year'), { target: { name: 'year', value: '2025' } })
    fireEvent.change(screen.getByTestId('input-rating'), { target: { name: 'rating', value: '8.0' } })
    fireEvent.change(screen.getByTestId('input-total_seasons'), { target: { name: 'total_seasons', value: '3' } })
    fireEvent.change(screen.getByTestId('input-poster_url'), { target: { name: 'poster_url', value: 'https://example.com/poster.jpg' } })
    fireEvent.change(screen.getByTestId('input-backdrop_url'), { target: { name: 'backdrop_url', value: 'https://example.com/backdrop.jpg' } })

    const buttons = screen.getAllByText('Crear')
    const createButton = buttons.find((b) => b.closest('[data-testid="modal"]'))
    fireEvent.click(createButton!)
    await waitFor(() => {
      expect(mockCreateSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Series',
          description: 'A new show',
          category_id: 1,
          year: 2025,
          rating: 8.0,
          total_seasons: 3,
          poster_url: 'https://example.com/poster.jpg',
          backdrop_url: 'https://example.com/backdrop.jpg',
        })
      )
      expect(mockToast.success).toHaveBeenCalledWith('Serie creada correctamente')
    })
  })

  it('cancels delete confirm dialog', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
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

  it('shows episodes in episode manager modal', async () => {
    const sampleEpisodes = [
      {
        id: 10,
        title: 'Pilot',
        description: '',
        season_number: 1,
        episode_number: 1,
        duration: 3600,
        transcode_status: 'completed',
        transcode_progress: 100,
        series_id: 1,
        is_active: true,
        year: 2008,
        rating: 9.0,
        poster_url: '',
        backdrop_url: '',
        hls_path: '/media/s1e1.mp4',
        resolution: '1080p',
        category: null,
        category_id: null,
      },
      {
        id: 11,
        title: 'Cats in the Bag',
        description: '',
        season_number: 1,
        episode_number: 2,
        duration: 2700,
        transcode_status: 'processing',
        transcode_progress: 55,
        series_id: 1,
        is_active: true,
        year: 2008,
        rating: 8.5,
        poster_url: '',
        backdrop_url: '',
        hls_path: '',
        resolution: '',
        category: null,
        category_id: null,
      },
    ]
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText(/Episodios.*Breaking Bad/)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('Pilot')).toBeInTheDocument()
      expect(screen.getByText('Cats in the Bag')).toBeInTheDocument()
    })
    // Check transcode status badges
    expect(screen.getByText('Listo')).toBeInTheDocument()
    expect(screen.getByText('55%')).toBeInTheDocument()
    // Check episode count display
    expect(screen.getByText('2 episodio(s)')).toBeInTheDocument()
  })

  it('shows empty state in episode manager when no episodes', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText(/Episodios.*Breaking Bad/)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText(/No hay episodios/)).toBeInTheDocument()
    })
  })

  it('shows error toast when loading episodes fails', async () => {
    mockGetSeriesEpisodes.mockRejectedValue(new Error('fail'))
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar episodios')
    })
  })

  it('deletes an episode from episode manager', async () => {
    const mockDeleteVOD = adminAPI.deleteVOD as jest.Mock
    mockDeleteVOD.mockResolvedValue({})
    const sampleEpisodes = [
      {
        id: 10,
        title: 'Pilot',
        description: '',
        season_number: 1,
        episode_number: 1,
        duration: 3600,
        transcode_status: 'completed',
        transcode_progress: 100,
        series_id: 1,
        is_active: true,
        year: 2008,
        rating: 9.0,
        poster_url: '',
        backdrop_url: '',
        hls_path: '/media/s1e1.mp4',
        resolution: '1080p',
        category: null,
        category_id: null,
      },
    ]
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText('Pilot')).toBeInTheDocument()
    })
    const deleteEpButton = screen.getByTitle('Eliminar episodio')
    fireEvent.click(deleteEpButton)
    await waitFor(() => {
      expect(mockDeleteVOD).toHaveBeenCalledWith(10)
      expect(mockToast.success).toHaveBeenCalledWith('Episodio eliminado')
    })
  })

  it('shows error when deleting episode fails', async () => {
    const mockDeleteVOD = adminAPI.deleteVOD as jest.Mock
    mockDeleteVOD.mockRejectedValue(new Error('fail'))
    const sampleEpisodes = [
      {
        id: 10,
        title: 'Pilot',
        description: '',
        season_number: 1,
        episode_number: 1,
        duration: 3600,
        transcode_status: 'completed',
        transcode_progress: 100,
        series_id: 1,
        is_active: true,
        year: 2008,
        rating: 9.0,
        poster_url: '',
        backdrop_url: '',
        hls_path: '/media/s1e1.mp4',
        resolution: '1080p',
        category: null,
        category_id: null,
      },
    ]
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText('Pilot')).toBeInTheDocument()
    })
    const deleteEpButton = screen.getByTitle('Eliminar episodio')
    fireEvent.click(deleteEpButton)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar el episodio')
    })
  })

  it('shows error toast when TMDB Auto enrich fails', async () => {
    mockEnrichSeries.mockRejectedValue(new Error('fail'))
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('TMDB Auto')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('TMDB Auto'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al enriquecer series con TMDB')
    })
  })

  it('TMDB search button in create modal applies metadata', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear Serie')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('tmdb-search'))
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Metadatos TMDB aplicados')
    })
  })

  it('TMDB search in edit modal applies metadata and preserves existing fields', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Editar Serie')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('tmdb-search'))
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Metadatos TMDB aplicados')
    })
  })

  it('shows Subir episodio button in episode manager', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText(/Episodios.*Breaking Bad/)).toBeInTheDocument()
    })
    expect(screen.getByText('Subir episodio')).toBeInTheDocument()
  })

  it('opens episode upload modal from episode manager', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText('Subir episodio')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Subir episodio'))
    await waitFor(() => {
      expect(screen.getByText('Subir episodio', { selector: 'h2' })).toBeInTheDocument()
    })
    // Should show file select area
    expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument()
  })

  it('renders episode transcode statuses correctly', async () => {
    const episodes = [
      {
        id: 10, title: 'Completed Ep', season_number: 1, episode_number: 1,
        duration: 3600, transcode_status: 'completed', transcode_progress: 100,
        series_id: 1, is_active: true, year: 2008, rating: 9.0,
        poster_url: '', backdrop_url: '', hls_path: '/media/ep.mp4', resolution: '1080p',
        description: '', category: null, category_id: null,
      },
      {
        id: 11, title: 'Pending Ep', season_number: 1, episode_number: 2,
        duration: 0, transcode_status: 'pending', transcode_progress: 0,
        series_id: 1, is_active: true, year: 2008, rating: 0,
        poster_url: '', backdrop_url: '', hls_path: '', resolution: '',
        description: '', category: null, category_id: null,
      },
    ]
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: episodes } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText('Completed Ep')).toBeInTheDocument()
      expect(screen.getByText('Pending Ep')).toBeInTheDocument()
    })
    expect(screen.getByText('Listo')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('renders season/episode labels in episode manager', async () => {
    const episodes = [
      {
        id: 10, title: 'First Ep', season_number: 2, episode_number: 5,
        duration: 2400, transcode_status: 'completed', transcode_progress: 100,
        series_id: 1, is_active: true, year: 2009, rating: 8.5,
        poster_url: '', backdrop_url: '', hls_path: '/media/s2e5.mp4', resolution: '1080p',
        description: '', category: null, category_id: null,
      },
    ]
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: episodes } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText('T2E5')).toBeInTheDocument()
    })
  })
})
