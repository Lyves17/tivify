/**
 * Branch coverage tests for AdminVODPage (src/app/admin/vod/page.tsx)
 * Targets conditional branches: ternary operators, &&, ||, ??, if/else
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
      isAxiosError: jest.fn((err: any) => err?.isAxiosError === true),
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
      return <button data-testid="tmdb-search" onClick={() => onSelect({ title: 'TMDB Movie', year: 2025, description: 'desc', rating: 8.5, poster_url: 'http://p.jpg', backdrop_url: 'http://b.jpg' })}>TMDB</button>
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
const mockGetVODDebugStats = adminAPI.getVODDebugStats as jest.Mock
const mockGetUploadDiagnostics = adminAPI.getUploadDiagnostics as jest.Mock
const mockUploadMediaWithVOD = adminAPI.uploadMediaWithVOD as jest.Mock
const mockGetVOD = adminAPI.getVOD as jest.Mock
const mockDeleteVOD = adminAPI.deleteVOD as jest.Mock
const mockCreateVOD = adminAPI.createVOD as jest.Mock
const mockUpdateVOD = adminAPI.updateVOD as jest.Mock
const mockEnrichVODs = adminAPI.enrichVODs as jest.Mock

const vodCompleted = {
  id: 1, title: 'Inception', description: 'A thriller',
  category: { id: 1, name: 'Sci-Fi' }, category_id: 1,
  year: 2010, duration: 8880, rating: 8.8,
  poster_url: 'https://example.com/poster.jpg', backdrop_url: '',
  hls_path: '/media/inception/index.m3u8', resolution: '1080p',
  is_active: true, transcode_status: 'completed', transcode_progress: 100,
  series_id: null, season_number: 0, episode_number: 0,
}

const vodProcessing = {
  id: 2, title: 'Processing Movie', description: '',
  category: null, category_id: 0,
  year: 0, duration: 0, rating: 0,
  poster_url: '', backdrop_url: '',
  hls_path: '', resolution: '',
  is_active: false, transcode_status: 'processing', transcode_progress: 50,
  series_id: null, season_number: 0, episode_number: 0,
}

const vodFailed = {
  id: 3, title: 'Failed Movie', description: '',
  category: null, category_id: 0,
  year: 0, duration: 0, rating: 0,
  poster_url: '', backdrop_url: '',
  hls_path: '', resolution: '',
  is_active: true, transcode_status: 'failed', transcode_progress: 0,
  series_id: null, season_number: 0, episode_number: 0,
}

const vodPending = {
  id: 4, title: 'Pending Movie', description: '',
  category: null, category_id: 0,
  year: 0, duration: 0, rating: 0,
  poster_url: '', backdrop_url: '',
  hls_path: '', resolution: '',
  is_active: true, transcode_status: 'pending', transcode_progress: 0,
  series_id: null, season_number: 0, episode_number: 0,
}

// Episode VOD (has series_id) - tests visible = false branch
const vodEpisode = {
  id: 5, title: 'Episode', description: '',
  category: null, category_id: 0,
  year: 0, duration: 0, rating: 0,
  poster_url: '', backdrop_url: '',
  hls_path: '/media/ep.m3u8', resolution: '720p',
  is_active: true, transcode_status: 'completed', transcode_progress: 100,
  series_id: 10, season_number: 1, episode_number: 1,
}

const sampleCategories = [
  { id: 1, name: 'Sci-Fi' },
  { id: 2, name: 'Action' },
]

const debugStatsWithProblems = {
  total: 5, completed: 2, pending: 1, failed: 1, processing: 1,
  visible_to_users: 1, active_episodes: 1, inactive: 1,
  problems: [
    { id: 3, title: 'Failed Movie', reason: 'transcode_status=failed', hls_path: '' },
  ],
}

const debugStatsNoProblems = {
  total: 1, completed: 1, pending: 0, failed: 0, processing: 0,
  visible_to_users: 1, active_episodes: 0, inactive: 0,
  problems: [],
}

const uploadDiagData = {
  current_user: 'root', current_uid: 0,
  ffmpeg_ok: true, ffmpeg_version: '5.0',
  ffprobe_ok: false, ffprobe_version: '',
  disk_free_gb: 50.5, disk_total_gb: 200.0,
  media_path: '/media',
  directories: [
    { path: '/media/uploads', exists: true, writable: true },
    { path: '/media/hls', exists: true, writable: false },
    { path: '/media/tmp', exists: false, writable: false },
  ],
  pending_count: 1, processing_count: 1, completed_count: 2, failed_count: 1,
  recent_media: [
    {
      id: 10, original_filename: 'movie.mp4', file_size_bytes: 1048576,
      duration: 120, resolution: '1080p', status: 'completed', progress: 100,
      file_path: '/media/uploads/movie.mp4', hls_path: '/media/hls/movie/index.m3u8',
      file_exists: true, hls_exists: true, error_message: '',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 11, original_filename: 'bad.mkv', file_size_bytes: 500,
      duration: 0, resolution: '', status: 'failed', progress: 0,
      file_path: '', hls_path: '', file_exists: false, hls_exists: false,
      error_message: 'ffmpeg crashed',
      created_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 12, original_filename: 'proc.avi', file_size_bytes: 2000,
      duration: 0, resolution: '', status: 'processing', progress: 30,
      file_path: '/media/uploads/proc.avi', hls_path: '',
      file_exists: true, hls_exists: false, error_message: '',
      created_at: '2024-01-03T00:00:00Z',
    },
  ],
}

function setupDefaultMocks() {
  mockGetVODs.mockResolvedValue({
    data: { data: [vodCompleted, vodProcessing, vodFailed, vodPending, vodEpisode], meta: { pages: 1 } },
  })
  mockGetCategoriesByType.mockResolvedValue({
    data: { data: sampleCategories },
  })
  mockGetVODDebugStats.mockResolvedValue({
    data: { data: debugStatsWithProblems },
  })
  mockGetUploadDiagnostics.mockResolvedValue({
    data: { data: uploadDiagData },
  })
}

describe('VODPage - branch coverage: column render ternaries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders all transcode_status badges: completed, processing, pending, failed', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Listo').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Procesando/).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Error').length).toBeGreaterThan(0)
    })
  })

  it('renders processing status with progress percentage', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText(/Procesando 50%/)).toBeInTheDocument()
    })
  })

  it('renders active/inactive badges', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Si').length).toBeGreaterThan(0)
      expect(screen.getAllByText('No').length).toBeGreaterThan(0)
    })
  })

  it('renders visible "Si" for active non-episode and "No" for episode or inactive', async () => {
    render(<VODPage />)
    await waitFor(() => {
      // vodCompleted is visible (active, no series_id)
      // vodEpisode is not visible (has series_id)
      // vodProcessing is not visible (inactive)
      const siTexts = screen.getAllByText('Sí')
      const noTexts = screen.getAllByText('No')
      expect(siTexts.length).toBeGreaterThan(0)
      expect(noTexts.length).toBeGreaterThan(0)
    })
  })

  it('renders category name or "—" for null category', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })
  })
})

function clickVODDebugButton() {
  // Find all buttons, look for the one with text containing "Debug" but NOT "Upload Debug"
  const allButtons = document.querySelectorAll('button')
  const debugBtn = Array.from(allButtons).find(
    b => b.textContent?.includes('Debug') && !b.textContent?.includes('Upload')
  )
  if (debugBtn) fireEvent.click(debugBtn)
}

describe('VODPage - branch coverage: debug panel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('opens debug panel with problems list', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    clickVODDebugButton()

    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico de visibilidad VODs/)).toBeInTheDocument()
      // "Failed Movie" appears both in the table and in the debug panel
      expect(screen.getAllByText('Failed Movie').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('transcode_status=failed')).toBeInTheDocument()
    })
  })

  it('opens debug panel with no problems (shows green message)', async () => {
    mockGetVODDebugStats.mockResolvedValue({ data: { data: debugStatsNoProblems } })
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    clickVODDebugButton()
    await waitFor(() => {
      expect(screen.getByText(/Todos los VODs activos/)).toBeInTheDocument()
    })
  })

  it('debug panel problem has Editar button when vodItem is found in data', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    clickVODDebugButton()
    await waitFor(() => {
      const editBtns = screen.getAllByText('Editar')
      expect(editBtns.length).toBeGreaterThan(0)
    })
  })
})

describe('VODPage - branch coverage: upload diagnostics panel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('opens upload diagnostics panel showing all directory states', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico de Uploads/)).toBeInTheDocument()
      // Check directory states: exists+writable, exists+not-writable, not-exists
      expect(screen.getByText('/media/uploads')).toBeInTheDocument()
      expect(screen.getByText('/media/hls')).toBeInTheDocument()
      expect(screen.getByText('/media/tmp')).toBeInTheDocument()
      expect(screen.getAllByText('OK').length).toBeGreaterThan(0)
      expect(screen.getByText('Sin permiso de escritura')).toBeInTheDocument()
      expect(screen.getAllByText('No existe').length).toBeGreaterThan(0)
    })
  })

  it('shows ffmpeg OK and ffprobe not found status', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.getByText('No encontrado')).toBeInTheDocument()
    })
  })

  it('shows recent_media with different statuses and file/hls existence', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.getByText('movie.mp4')).toBeInTheDocument()
      expect(screen.getByText('bad.mkv')).toBeInTheDocument()
      expect(screen.getByText('ffmpeg crashed')).toBeInTheDocument()
    })
  })

  it('shows empty recent media message', async () => {
    mockGetUploadDiagnostics.mockResolvedValue({
      data: { data: { ...uploadDiagData, recent_media: [] } },
    })
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.getByText('No hay archivos subidos aún.')).toBeInTheDocument()
    })
  })

  it('shows loading state when diag is loading and no data yet', async () => {
    mockGetUploadDiagnostics.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(screen.getByText('Cargando diagnóstico...')).toBeInTheDocument()
    })
  })
})

describe('VODPage - branch coverage: manual form and edit modal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('switches to manual/advanced tab in create mode', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Crear VOD')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    // Click "Avanzado" tab
    fireEvent.click(screen.getByText('Avanzado'))
    await waitFor(() => {
      // In manual mode, the HLS path field and hint should appear
      expect(screen.getByText('Ruta HLS (para contenido externo)')).toBeInTheDocument()
      expect(screen.getByText(/Modo avanzado/)).toBeInTheDocument()
    })
  })

  it('creates VOD via manual form', async () => {
    mockCreateVOD.mockResolvedValue({})
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Crear VOD')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Avanzado'))
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Manual VOD' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockCreateVOD).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('VOD creado correctamente')
    })
  })

  it('opens edit modal showing HLS path read-only and resolution', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    // Click edit button for Inception
    const editBtns = screen.getAllByTitle('Editar')
    fireEvent.click(editBtns[0])
    await waitFor(() => {
      expect(screen.getByText('Editar VOD')).toBeInTheDocument()
      // In edit mode with hls_path, shows read-only path
      expect(screen.getByText(/Ruta HLS \(generada automáticamente\)/)).toBeInTheDocument()
      expect(screen.getByText('/media/inception/index.m3u8')).toBeInTheDocument()
      // Resolution info
      expect(screen.getByText('1080p')).toBeInTheDocument()
    })
  })

  it('updates VOD via edit form', async () => {
    mockUpdateVOD.mockResolvedValue({})
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    const editBtns = screen.getAllByTitle('Editar')
    fireEvent.click(editBtns[0])
    await waitFor(() => expect(screen.getByText('Editar VOD')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => {
      expect(mockUpdateVOD).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Inception' }))
      expect(mockToast.success).toHaveBeenCalledWith('VOD actualizado correctamente')
    })
  })

  it('shows error when manual form save fails', async () => {
    mockCreateVOD.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Crear VOD')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Avanzado'))
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Test' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al guardar el VOD')
    })
  })
})

describe('VODPage - branch coverage: form validations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('shows error when title is empty', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Crear VOD')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Avanzado'))
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El título es requerido')
    })
  })

  it('shows error when title exceeds 200 chars', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Crear VOD')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Avanzado'))
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'X'.repeat(201) } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El título no puede exceder 200 caracteres')
    })
  })

  it('handles checkbox change in form', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Crear VOD')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Avanzado'))
    const checkbox = screen.getByLabelText('Activo')
    fireEvent.change(checkbox, { target: { name: 'is_active', type: 'checkbox', checked: false } })
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })
})

describe('VODPage - branch coverage: TMDB enrich and select', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('handles TMDB bulk enrich success', async () => {
    mockEnrichVODs.mockResolvedValue({
      data: { data: { enriched: 2, skipped: 1, failed: 0 } },
    })
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    fireEvent.click(screen.getByText('TMDB Auto'))
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('TMDB: 2 enriquecidos, 1 omitidos, 0 fallidos')
    })
  })

  it('handles TMDB bulk enrich error', async () => {
    mockEnrichVODs.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    fireEvent.click(screen.getByText('TMDB Auto'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al enriquecer VODs con TMDB')
    })
  })

  it('applies TMDB selection in edit modal', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    const editBtns = screen.getAllByTitle('Editar')
    fireEvent.click(editBtns[0])
    await waitFor(() => expect(screen.getByText('Editar VOD')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('tmdb-search'))
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Metadatos TMDB aplicados')
    })
  })
})

describe('VODPage - branch coverage: delete cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('cancels delete confirmation dialog', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    const deleteBtns = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteBtns[0])
    await waitFor(() => expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
    expect(mockDeleteVOD).not.toHaveBeenCalled()
  })

  it('shows error when delete fails', async () => {
    mockDeleteVOD.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    const deleteBtns = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteBtns[0])
    await waitFor(() => expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar el VOD')
    })
  })
})

describe('VODPage - branch coverage: upload error branches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('shows upload error with uploadError message displayed', async () => {
    const axiosError = {
      isAxiosError: true,
      response: { status: 413, data: { message: 'too large' } },
      message: 'Request Entity Too Large',
      code: undefined,
    }
    mockUploadMediaWithVOD.mockRejectedValue(axiosError)

    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Crear VOD')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'big.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText('big.mp4')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Subir'))
    await waitFor(() => {
      // 413 error should show "demasiado grande" message
      expect(mockToast.error).toHaveBeenCalled()
    })

    // Error message should be visible in the UI
    await waitFor(() => {
      expect(screen.getByText('Error en la subida')).toBeInTheDocument()
    })
  })

  it('shows transcode failed error in polling', async () => {
    jest.useFakeTimers()

    mockUploadMediaWithVOD.mockResolvedValue({
      data: { success: true, data: { id: 20, title: 'Trans', transcode_status: 'processing', hls_path: '' } },
      status: 200,
    })
    mockGetVOD.mockResolvedValue({
      data: { data: { id: 20, transcode_status: 'failed', transcode_progress: 0, hls_path: '' } },
    })

    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Crear VOD')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByText('Crear VOD')) })
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'fail.mkv', { type: 'video/x-matroska' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    await act(async () => { fireEvent.change(fileInput, { target: { files: [file] } }) })
    await waitFor(() => expect(screen.getByText('fail.mkv')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByText('Subir')) })
    await waitFor(() => expect(mockUploadMediaWithVOD).toHaveBeenCalled())

    // Advance timer for poll
    await act(async () => { jest.advanceTimersByTime(3000) })
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error en la transcodificación')
    })

    jest.useRealTimers()
  })
})

describe('VODPage - branch coverage: fetch errors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows error when fetching VODs fails', async () => {
    mockGetVODs.mockRejectedValue(new Error('fail'))
    mockGetCategoriesByType.mockResolvedValue({ data: { data: sampleCategories } })
    mockGetVODDebugStats.mockResolvedValue({ data: { data: null } })
    mockGetUploadDiagnostics.mockResolvedValue({ data: { data: null } })

    render(<VODPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar los VODs')
    })
  })

  it('shows error when fetching categories fails', async () => {
    mockGetVODs.mockResolvedValue({ data: { data: [], meta: { pages: 1 } } })
    mockGetCategoriesByType.mockRejectedValue(new Error('fail'))
    mockGetVODDebugStats.mockResolvedValue({ data: { data: null } })
    mockGetUploadDiagnostics.mockResolvedValue({ data: { data: null } })

    render(<VODPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error cargando categorías')
    })
  })

  it('shows error when fetching upload diagnostics fails', async () => {
    mockGetVODs.mockResolvedValue({ data: { data: [vodCompleted], meta: { pages: 1 } } })
    mockGetCategoriesByType.mockResolvedValue({ data: { data: sampleCategories } })
    mockGetVODDebugStats.mockResolvedValue({ data: { data: null } })
    mockGetUploadDiagnostics.mockRejectedValue(new Error('fail'))

    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Inception')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Upload Debug'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar diagnóstico de uploads')
    })
  })
})

describe('VODPage - branch coverage: edit VOD with no optional fields (falsy branches)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('opens edit for VOD with no description, no category, no year, no rating, no poster', async () => {
    render(<VODPage />)
    await waitFor(() => expect(screen.getByText('Processing Movie')).toBeInTheDocument())

    // Click edit for Processing Movie (index 1 in our data)
    const editBtns = screen.getAllByTitle('Editar')
    fireEvent.click(editBtns[1])
    await waitFor(() => expect(screen.getByText('Editar VOD')).toBeInTheDocument())

    // Verify form loaded with empty defaults
    const titleInput = screen.getByTestId('input-title') as HTMLInputElement
    expect(titleInput.value).toBe('Processing Movie')
  })
})
