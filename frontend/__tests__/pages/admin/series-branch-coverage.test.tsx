/**
 * Branch coverage tests for AdminSeriesPage (src/app/admin/series/page.tsx)
 * Targets conditional branches not covered by existing tests.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
      return <button data-testid="tmdb-search" onClick={() => onSelect({ title: 'TMDB Series', year: 2025, description: 'desc', rating: 9.0, poster_url: 'http://p.jpg', backdrop_url: 'http://b.jpg' })}>TMDB</button>
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
const mockDeleteVOD = adminAPI.deleteVOD as jest.Mock
const mockUploadMediaWithVOD = adminAPI.uploadMediaWithVOD as jest.Mock
const mockGetVOD = adminAPI.getVOD as jest.Mock
const mockEnrichSeries = adminAPI.enrichSeries as jest.Mock

const activeSeries = {
  id: 1, title: 'Breaking Bad', description: 'A chemistry teacher',
  category: { id: 1, name: 'Drama' }, category_id: 1,
  year: 2008, rating: 9.5, total_seasons: 5, episodes_count: 62,
  poster_url: 'https://example.com/bb.jpg', backdrop_url: '',
  is_active: true,
}

const inactiveSeries = {
  id: 2, title: 'Cancelled Show', description: '',
  category: null, category_id: 0,
  year: 0, rating: 0, total_seasons: 0, episodes_count: 0,
  poster_url: '', backdrop_url: '',
  is_active: false,
}

const sampleCategories = [
  { id: 1, name: 'Drama' },
  { id: 2, name: 'Comedy' },
]

const episodeCompleted = {
  id: 10, title: 'Pilot', season_number: 1, episode_number: 1,
  duration: 3600, transcode_status: 'completed', transcode_progress: 100,
  series_id: 1,
}

const episodeProcessing = {
  id: 11, title: 'Episode 2', season_number: 1, episode_number: 2,
  duration: 3000, transcode_status: 'processing', transcode_progress: 65,
  series_id: 1,
}

const episodePending = {
  id: 12, title: 'Episode 3', season_number: 2, episode_number: 1,
  duration: 0, transcode_status: 'pending', transcode_progress: 0,
  series_id: 1,
}

function setupDefaultMocks() {
  mockGetSeries.mockResolvedValue({
    data: { data: [activeSeries, inactiveSeries], meta: { pages: 1 } },
  })
  mockGetCategoriesByType.mockResolvedValue({
    data: { data: sampleCategories },
  })
}

describe('SeriesPage - branch coverage: column render ternaries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders active and inactive series status badges', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Activo')).toBeInTheDocument()
      expect(screen.getByText('Inactivo')).toBeInTheDocument()
    })
  })

  it('renders category name or "—" for null category', async () => {
    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Drama')).toBeInTheDocument()
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })
})

describe('SeriesPage - branch coverage: create/edit form', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('opens create modal with empty form', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Crear Serie')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => {
      expect(screen.getByText('Crear Serie', { selector: 'h2' })).toBeInTheDocument()
      expect(screen.getByText('Crear', { selector: 'button' })).toBeInTheDocument()
    })
  })

  it('creates series successfully', async () => {
    mockCreateSeries.mockResolvedValue({})
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Crear Serie')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'New Series' } })
    fireEvent.click(screen.getByText('Crear', { selector: 'button' }))
    await waitFor(() => {
      expect(mockCreateSeries).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Serie creada correctamente')
    })
  })

  it('opens edit modal with pre-filled form', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const editBtns = screen.getAllByTitle('Editar')
    fireEvent.click(editBtns[0])
    await waitFor(() => {
      expect(screen.getByText('Editar Serie')).toBeInTheDocument()
      expect(screen.getByText('Actualizar')).toBeInTheDocument()
    })
  })

  it('opens edit for series with no optional fields (falsy || branches)', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Cancelled Show')).toBeInTheDocument())

    const editBtns = screen.getAllByTitle('Editar')
    fireEvent.click(editBtns[1])
    await waitFor(() => {
      expect(screen.getByText('Editar Serie')).toBeInTheDocument()
      const titleInput = screen.getByTestId('input-title') as HTMLInputElement
      expect(titleInput.value).toBe('Cancelled Show')
    })
  })

  it('updates series successfully', async () => {
    mockUpdateSeries.mockResolvedValue({})
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const editBtns = screen.getAllByTitle('Editar')
    fireEvent.click(editBtns[0])
    await waitFor(() => expect(screen.getByText('Actualizar')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockUpdateSeries).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Breaking Bad' }))
      expect(mockToast.success).toHaveBeenCalledWith('Serie actualizada correctamente')
    })
  })

  it('shows error when title is empty', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Crear Serie')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear', { selector: 'button' }))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El título es requerido')
    })
  })

  it('shows error when title exceeds 200 chars', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Crear Serie')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'X'.repeat(201) } })
    fireEvent.click(screen.getByText('Crear', { selector: 'button' }))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El título no puede exceder 200 caracteres')
    })
  })

  it('shows error when save fails', async () => {
    mockCreateSeries.mockRejectedValue(new Error('fail'))
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Crear Serie')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Test' } })
    fireEvent.click(screen.getByText('Crear', { selector: 'button' }))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al guardar la serie')
    })
  })

  it('handles checkbox change in form', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Crear Serie')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear Serie'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    const checkbox = screen.getByLabelText('Activo')
    fireEvent.change(checkbox, { target: { name: 'is_active', type: 'checkbox', checked: false } })
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })

  it('applies TMDB selection to form', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const editBtns = screen.getAllByTitle('Editar')
    fireEvent.click(editBtns[0])
    await waitFor(() => expect(screen.getByText('Editar Serie')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('tmdb-search'))
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Metadatos TMDB aplicados')
    })
  })
})

describe('SeriesPage - branch coverage: delete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('cancels delete confirmation dialog', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const deleteBtns = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteBtns[0])
    await waitFor(() => expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument())
    expect(mockDeleteSeries).not.toHaveBeenCalled()
  })

  it('shows error when delete fails', async () => {
    mockDeleteSeries.mockRejectedValue(new Error('fail'))
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const deleteBtns = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteBtns[0])
    await waitFor(() => expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar la serie')
    })
  })
})

describe('SeriesPage - branch coverage: episode manager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('shows episode manager with episodes sorted by season/episode', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({
      data: { data: [episodePending, episodeCompleted, episodeProcessing] },
    })
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => {
      expect(screen.getByText(/Episodios — Breaking Bad/)).toBeInTheDocument()
      expect(screen.getByText('Pilot')).toBeInTheDocument()
      expect(screen.getByText('Episode 2')).toBeInTheDocument()
      expect(screen.getByText('Episode 3')).toBeInTheDocument()
    })
  })

  it('shows all transcode_status badges: completed, processing, other', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({
      data: { data: [episodeCompleted, episodeProcessing, episodePending] },
    })
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => {
      expect(screen.getAllByText('Listo').length).toBeGreaterThan(0)
      expect(screen.getByText('65%')).toBeInTheDocument()
      expect(screen.getByText('pending')).toBeInTheDocument()
    })
  })

  it('shows empty episodes message', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => {
      expect(screen.getByText(/No hay episodios/)).toBeInTheDocument()
    })
  })

  it('shows loading state while loading episodes', async () => {
    mockGetSeriesEpisodes.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => {
      expect(screen.getByText('Cargando...')).toBeInTheDocument()
    })
  })

  it('shows error when loading episodes fails', async () => {
    mockGetSeriesEpisodes.mockRejectedValue(new Error('fail'))
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar episodios')
    })
  })

  it('deletes an episode successfully', async () => {
    mockDeleteVOD.mockResolvedValue({})
    mockGetSeriesEpisodes.mockResolvedValue({
      data: { data: [episodeCompleted] },
    })
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument())

    const deleteEpBtns = screen.getAllByTitle('Eliminar episodio')
    fireEvent.click(deleteEpBtns[0])
    await waitFor(() => {
      expect(mockDeleteVOD).toHaveBeenCalledWith(10)
      expect(mockToast.success).toHaveBeenCalledWith('Episodio eliminado')
    })
  })

  it('shows error when deleting episode fails', async () => {
    mockDeleteVOD.mockRejectedValue(new Error('fail'))
    mockGetSeriesEpisodes.mockResolvedValue({
      data: { data: [episodeCompleted] },
    })
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument())

    const deleteEpBtns = screen.getAllByTitle('Eliminar episodio')
    fireEvent.click(deleteEpBtns[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar el episodio')
    })
  })

  it('closes episode manager modal', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => expect(screen.getByText(/Episodios — Breaking Bad/)).toBeInTheDocument())

    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => expect(screen.queryByText(/Episodios — Breaking Bad/)).not.toBeInTheDocument())
  })
})

describe('SeriesPage - branch coverage: episode upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })
  })

  it('shows all upload steps: idle, selected, uploading, done', async () => {
    mockUploadMediaWithVOD.mockResolvedValue({
      data: { data: { id: 100, transcode_status: 'completed' } },
    })

    jest.useFakeTimers()

    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    await act(async () => { fireEvent.click(epBtns[0]) })
    await waitFor(() => expect(screen.getByText('Subir episodio')).toBeInTheDocument())

    // Open upload modal - idle state
    await act(async () => { fireEvent.click(screen.getByText('Subir episodio')) })
    await waitFor(() => expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument())

    // Select file - selected state
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'ep1.mp4', { type: 'video/mp4' })
    await act(async () => { fireEvent.change(fileInput, { target: { files: [file] } }) })
    await waitFor(() => expect(screen.getByText('ep1.mp4')).toBeInTheDocument())

    // Fill required fields
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'My Ep' } })

    // Submit - goes through uploading to done
    await act(async () => { fireEvent.click(screen.getByText('Subir y crear episodio')) })
    await waitFor(() => expect(mockUploadMediaWithVOD).toHaveBeenCalled())

    // done state
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Episodio T1E1 creado')
    })

    // setTimeout closes the modal
    await act(async () => { jest.advanceTimersByTime(1500) })

    jest.useRealTimers()
  })

  it('shows error when episode title is empty', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => expect(screen.getByText('Subir episodio')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Subir episodio'))
    await waitFor(() => expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'ep.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Subir y crear episodio')).toBeInTheDocument())

    // Clear title
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: '' } })
    fireEvent.click(screen.getByText('Subir y crear episodio'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El titulo del episodio es obligatorio')
    })
  })

  it('shows error when season/episode are empty', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => expect(screen.getByText('Subir episodio')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Subir episodio'))
    await waitFor(() => expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'ep.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Subir y crear episodio')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'My Ep' } })
    fireEvent.change(screen.getByTestId('input-season_number'), { target: { name: 'season_number', value: '' } })
    fireEvent.click(screen.getByText('Subir y crear episodio'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Temporada y episodio son obligatorios')
    })
  })

  it('shows error when upload fails', async () => {
    mockUploadMediaWithVOD.mockRejectedValue(new Error('fail'))

    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => expect(screen.getByText('Subir episodio')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Subir episodio'))
    await waitFor(() => expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'ep.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Subir y crear episodio')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'My Ep' } })
    fireEvent.click(screen.getByText('Subir y crear episodio'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al subir el episodio')
    })
  })

  it('shows processing state when transcode is needed', async () => {
    jest.useFakeTimers()

    mockUploadMediaWithVOD.mockResolvedValue({
      data: { data: { id: 100, transcode_status: 'processing' } },
    })
    mockGetVOD.mockResolvedValue({
      data: { data: { id: 100, transcode_status: 'processing', transcode_progress: 50 } },
    })

    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    await act(async () => { fireEvent.click(epBtns[0]) })
    await waitFor(() => expect(screen.getByText('Subir episodio')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByText('Subir episodio')) })
    await waitFor(() => expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'ep.mkv', { type: 'video/x-matroska' })
    await act(async () => { fireEvent.change(fileInput, { target: { files: [file] } }) })
    await waitFor(() => expect(screen.getByText('Subir y crear episodio')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Trans Ep' } })
    await act(async () => { fireEvent.click(screen.getByText('Subir y crear episodio')) })
    await waitFor(() => expect(mockUploadMediaWithVOD).toHaveBeenCalled())

    // Should show processing state
    await waitFor(() => {
      expect(screen.getByText('Convirtiendo a MP4...')).toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  it('handles transcode failure in polling', async () => {
    jest.useFakeTimers()

    mockUploadMediaWithVOD.mockResolvedValue({
      data: { data: { id: 100, transcode_status: 'processing' } },
    })
    mockGetVOD.mockResolvedValue({
      data: { data: { id: 100, transcode_status: 'failed', transcode_progress: 0 } },
    })

    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    await act(async () => { fireEvent.click(epBtns[0]) })
    await waitFor(() => expect(screen.getByText('Subir episodio')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByText('Subir episodio')) })
    await waitFor(() => expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'ep.mkv', { type: 'video/x-matroska' })
    await act(async () => { fireEvent.change(fileInput, { target: { files: [file] } }) })
    await waitFor(() => expect(screen.getByText('Subir y crear episodio')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Fail Ep' } })
    await act(async () => { fireEvent.click(screen.getByText('Subir y crear episodio')) })
    await waitFor(() => expect(mockUploadMediaWithVOD).toHaveBeenCalled())

    // Advance timer for poll
    await act(async () => { jest.advanceTimersByTime(3000) })
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error en la transcodificación del episodio')
    })

    jest.useRealTimers()
  })

  it('does not select file when change event has no files', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => expect(screen.getByText('Subir episodio')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Subir episodio'))
    await waitFor(() => expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [] } })

    // Should still be in idle state
    expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument()
  })

  it('auto-fills title from filename when title is empty', async () => {
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())

    const epBtns = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(epBtns[0])
    await waitFor(() => expect(screen.getByText('Subir episodio')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Subir episodio'))
    await waitFor(() => expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'my_episode.file.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Title should be auto-filled from filename
    await waitFor(() => {
      const titleInput = screen.getByTestId('input-title') as HTMLInputElement
      expect(titleInput.value).toBe('my episode file')
    })
  })
})

describe('SeriesPage - branch coverage: TMDB bulk enrich', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('enriches series via TMDB successfully', async () => {
    mockEnrichSeries.mockResolvedValue({
      data: { data: { enriched: 2, skipped: 1, failed: 0 } },
    })
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('TMDB Auto')).toBeInTheDocument())

    fireEvent.click(screen.getByText('TMDB Auto'))
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('TMDB: 2 enriquecidas, 1 omitidas, 0 fallidas')
    })
  })

  it('shows error when TMDB enrich fails', async () => {
    mockEnrichSeries.mockRejectedValue(new Error('fail'))
    render(<SeriesPage />)
    await waitFor(() => expect(screen.getByText('TMDB Auto')).toBeInTheDocument())

    fireEvent.click(screen.getByText('TMDB Auto'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al enriquecer series con TMDB')
    })
  })
})

describe('SeriesPage - branch coverage: fetch errors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows error when fetching series fails', async () => {
    mockGetSeries.mockRejectedValue(new Error('fail'))
    mockGetCategoriesByType.mockResolvedValue({ data: { data: sampleCategories } })
    render(<SeriesPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar las series')
    })
  })

  it('shows error when fetching categories fails', async () => {
    mockGetSeries.mockResolvedValue({ data: { data: [], meta: { pages: 1 } } })
    mockGetCategoriesByType.mockRejectedValue(new Error('fail'))
    render(<SeriesPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error cargando categorías')
    })
  })
})
