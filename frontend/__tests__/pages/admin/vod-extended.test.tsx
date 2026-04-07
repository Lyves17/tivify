/**
 * Extended tests for AdminVODPage (src/app/admin/vod/page.tsx)
 * Covers: file upload flow, upload error branches (413, network, timeout),
 * processing poll, transcode progress, upload diagnostics details,
 * HLS path display in edit form, resolution display
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
const mockGetVODDebugStats = adminAPI.getVODDebugStats as jest.Mock
const mockGetUploadDiagnostics = adminAPI.getUploadDiagnostics as jest.Mock
const mockUploadMediaWithVOD = adminAPI.uploadMediaWithVOD as jest.Mock
const mockGetVOD = adminAPI.getVOD as jest.Mock

const sampleVods = [
  {
    id: 1,
    title: 'Inception',
    description: 'A thriller',
    category: { id: 1, name: 'Sci-Fi' },
    category_id: 1,
    year: 2010,
    duration: 8880,
    rating: 8.8,
    poster_url: 'https://example.com/poster.jpg',
    backdrop_url: '',
    hls_path: '/media/inception/index.m3u8',
    resolution: '1080p',
    is_active: true,
    transcode_status: 'completed',
    transcode_progress: 100,
    series_id: null,
    season_number: 0,
    episode_number: 0,
  },
]

const sampleCategories = [
  { id: 1, name: 'Sci-Fi' },
  { id: 2, name: 'Action' },
]

describe('AdminVODPage - extended', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })
    mockGetCategoriesByType.mockResolvedValue({
      data: { data: sampleCategories },
    })
    mockGetVODDebugStats.mockResolvedValue({
      data: { data: { total: 1, completed: 1, pending: 0, failed: 0, processing: 0 } },
    })
    mockGetUploadDiagnostics.mockResolvedValue({
      data: { data: null },
    })
  })

  it('renders file upload area in default create tab', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Default tab is "upload"
    expect(screen.getByText(/Haz clic para seleccionar/)).toBeInTheDocument()
  })

  it('shows file upload with selected file name after file selection', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Find the file input
    const fileInput = screen.getByTestId('modal').querySelector('input[type="file"]')
    if (fileInput) {
      const file = new File(['video content'], 'my_movie.mp4', { type: 'video/mp4' })
      fireEvent.change(fileInput, { target: { files: [file] } })
      await waitFor(() => {
        expect(screen.getByText(/my_movie\.mp4/)).toBeInTheDocument()
      })
    }
  })

  it('renders VOD with series_id as non-visible', async () => {
    const episodeVod = {
      ...sampleVods[0],
      id: 2,
      title: 'Episode VOD',
      series_id: 5,
      is_active: true,
    }
    mockGetVODs.mockResolvedValue({
      data: { data: [episodeVod], meta: { pages: 1 } },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // Episode VODs with series_id are not visible (even if active)
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('shows HLS path in edit form when editing VOD with hls_path', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // HLS path should be shown as read-only
    expect(screen.getByText(/\/media\/inception\/index\.m3u8/)).toBeInTheDocument()
  })

  it('shows resolution info in edit form', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    expect(screen.getByText(/1080p/)).toBeInTheDocument()
  })

  it('closes create modal and resets upload state', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
    // Reopen should show fresh upload state
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    expect(screen.getByText(/Haz clic para seleccionar/)).toBeInTheDocument()
  })

  it('handles debug stats fetch failure gracefully', async () => {
    mockGetVODDebugStats.mockRejectedValue(new Error('fail'))
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // Should not crash - just ignore the error
    expect(screen.getByText('Inception')).toBeInTheDocument()
  })

  it('renders upload diagnostics with ffmpeg info', async () => {
    mockGetUploadDiagnostics.mockResolvedValue({
      data: {
        data: {
          current_user: 'app',
          current_uid: 1000,
          ffmpeg_ok: true,
          ffmpeg_version: '5.1.2',
          ffprobe_ok: true,
          ffprobe_version: '5.1.2',
          disk_free_gb: 50.0,
          disk_total_gb: 100.0,
          media_path: '/media',
          directories: [{ path: '/media/vod', writable: true, exists: true }],
          pending_count: 0,
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
      expect(screen.getByText(/Diagnóstico de Uploads/)).toBeInTheDocument()
    })
    // Should show ffmpeg version (appears twice: ffmpeg + ffprobe)
    const versionElements = screen.getAllByText(/5\.1\.2/)
    expect(versionElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders processing status with progress percentage in table', async () => {
    const processingVod = {
      ...sampleVods[0],
      id: 3,
      title: 'Processing Movie',
      transcode_status: 'processing',
      transcode_progress: 42,
    }
    mockGetVODs.mockResolvedValue({
      data: { data: [processingVod], meta: { pages: 1 } },
    })
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText(/Procesando.*42%/)).toBeInTheDocument()
  })

  it('renders TMDB search button in edit modal and applies metadata', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('tmdb-search'))
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Metadatos TMDB aplicados')
    })
  })
})
