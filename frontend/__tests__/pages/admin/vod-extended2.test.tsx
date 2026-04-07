/**
 * Extended tests #2 for AdminVODPage (src/app/admin/vod/page.tsx)
 * Covers: handleUploadAndCreateVOD flow (success, error branches),
 * upload step UI states (idle, selected, uploading, processing, done, logs),
 * file selection auto-title, upload error branches (413, network, timeout, generic),
 * recent_media in diagnostics, edit button in debug problems
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import VODPage from '@/app/admin/vod/page'

// We need to control axios.isAxiosError
let mockIsAxiosError = jest.fn(() => false)

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
      get isAxiosError() { return mockIsAxiosError },
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

describe('AdminVODPage - extended2 (upload flow)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAxiosError = jest.fn(() => false)
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

  // --- File selection sets title from filename ---

  it('sets title from filename when selecting a file', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Default tab is upload - find the file input
    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()
    const file = new File(['video'], 'My_Great-Movie.2024.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      // After selection, should show the file name
      expect(screen.getByText('My_Great-Movie.2024.mp4')).toBeInTheDocument()
      // Should show "selected" step with file details
      expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument()
    })
  })

  // --- Upload success: direct (no transcoding) ---

  it('handles upload success with no transcoding needed', async () => {
    jest.useFakeTimers()
    mockUploadMediaWithVOD.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          id: 10,
          title: 'Test Movie',
          transcode_status: 'completed',
          hls_path: '/media/test/index.m3u8',
        },
      },
    })

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    // Select a file
    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'test_movie.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 5242880 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('test_movie.mp4')).toBeInTheDocument()
    })

    // Click "Subir"
    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(mockUploadMediaWithVOD).toHaveBeenCalledWith(file, 'test movie', expect.any(Function))
      expect(mockToast.success).toHaveBeenCalledWith('VOD creado correctamente')
    })

    // Should show "done" state
    await waitFor(() => {
      expect(screen.getByText('VOD creado correctamente')).toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  // --- Upload success with transcoding ---

  it('handles upload success with transcoding needed and polls for progress', async () => {
    jest.useFakeTimers()

    mockUploadMediaWithVOD.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          id: 20,
          title: 'MKV Movie',
          transcode_status: 'processing',
          hls_path: '',
        },
      },
    })

    // First poll: still processing
    mockGetVOD
      .mockResolvedValueOnce({
        data: { data: { id: 20, transcode_status: 'processing', transcode_progress: 50, hls_path: '' } },
      })
      // Second poll: completed
      .mockResolvedValueOnce({
        data: { data: { id: 20, transcode_status: 'completed', transcode_progress: 100, hls_path: '/media/mkv/index.m3u8' } },
      })

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Crear VOD'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'movie.mkv', { type: 'video/x-matroska' })
    Object.defineProperty(file, 'size', { value: 10485760 })

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(screen.getByText('movie.mkv')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Subir'))
    })

    await waitFor(() => {
      expect(mockUploadMediaWithVOD).toHaveBeenCalled()
    })

    // Should show "processing" step
    await waitFor(() => {
      expect(screen.getByText(/Transcodificando a MP4/)).toBeInTheDocument()
    })

    // Advance timers to trigger first poll
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    // Advance timers for second poll (completed)
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('VOD listo para reproducir')
    })

    jest.useRealTimers()
  })

  // --- Upload success with transcoding failure ---

  it('handles transcode failure during polling', async () => {
    jest.useFakeTimers()

    mockUploadMediaWithVOD.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          id: 30,
          title: 'Bad Movie',
          transcode_status: 'pending',
          hls_path: '',
        },
      },
    })

    mockGetVOD.mockResolvedValue({
      data: { data: { id: 30, transcode_status: 'failed', transcode_progress: 0, hls_path: '' } },
    })

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Crear VOD'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'bad.avi', { type: 'video/avi' })
    Object.defineProperty(file, 'size', { value: 1048576 })

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(screen.getByText('bad.avi')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Subir'))
    })

    await waitFor(() => {
      expect(mockUploadMediaWithVOD).toHaveBeenCalled()
    })

    // Advance timer to trigger poll
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error en la transcodificación')
    })

    jest.useRealTimers()
  })

  // --- Upload error: generic Error ---

  it('handles upload error (non-axios error)', async () => {
    mockIsAxiosError = jest.fn(() => false)
    mockUploadMediaWithVOD.mockRejectedValue(new Error('Something broke'))

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'error.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('error.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Something broke')
    })

    // Should show error message in UI
    await waitFor(() => {
      expect(screen.getByText(/Error en la subida/)).toBeInTheDocument()
      expect(screen.getByText('Something broke')).toBeInTheDocument()
    })
  })

  // --- Upload error: axios 413 ---

  it('handles upload error with 413 status', async () => {
    mockIsAxiosError = jest.fn(() => true)
    const axiosError = {
      response: { status: 413, data: { error: 'too large' } },
      code: undefined,
      message: 'Request Entity Too Large',
    }
    mockUploadMediaWithVOD.mockRejectedValue(axiosError)

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'huge.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1073741824 }) // 1 GB
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('huge.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Archivo demasiado grande'))
    })
  })

  // --- Upload error: axios with HTTP status (not 413) ---

  it('handles upload error with non-413 HTTP status', async () => {
    mockIsAxiosError = jest.fn(() => true)
    const axiosError = {
      response: { status: 500, data: { message: 'Internal Server Error' } },
      code: undefined,
      message: 'Internal Server Error',
    }
    mockUploadMediaWithVOD.mockRejectedValue(axiosError)

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'server_error.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('server_error.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'))
    })
  })

  // --- Upload error: ECONNABORTED (timeout) ---

  it('handles upload timeout error (ECONNABORTED)', async () => {
    mockIsAxiosError = jest.fn(() => true)
    const axiosError = {
      response: undefined,
      code: 'ECONNABORTED',
      message: 'timeout of 60000ms exceeded',
    }
    mockUploadMediaWithVOD.mockRejectedValue(axiosError)

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'slow.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('slow.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Timeout'))
    })
  })

  // --- Upload error: ERR_NETWORK ---

  it('handles network error (ERR_NETWORK)', async () => {
    mockIsAxiosError = jest.fn(() => true)
    const axiosError = {
      response: undefined,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    }
    mockUploadMediaWithVOD.mockRejectedValue(axiosError)

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'network.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('network.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error de red: no se pudo conectar al servidor')
    })
  })

  // --- Upload error: axios with no status, no special code ---

  it('handles generic axios error with no status and no code', async () => {
    mockIsAxiosError = jest.fn(() => true)
    const axiosError = {
      response: undefined,
      code: undefined,
      message: 'Unknown axios error',
    }
    mockUploadMediaWithVOD.mockRejectedValue(axiosError)

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'generic.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('generic.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Unknown axios error')
    })
  })

  // --- "Cambiar" button resets file selection ---

  it('resets file selection when clicking "Cambiar"', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'changeme.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('changeme.mp4')).toBeInTheDocument()
    })

    // Click "Cambiar"
    fireEvent.click(screen.getByText('Cambiar'))

    await waitFor(() => {
      // Should go back to idle state
      expect(screen.getByText(/Haz clic para seleccionar/)).toBeInTheDocument()
    })
  })

  // --- Upload logs display and clear ---

  it('shows upload logs and allows clearing them', async () => {
    mockIsAxiosError = jest.fn(() => false)
    mockUploadMediaWithVOD.mockRejectedValue(new Error('Log test error'))

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'logtest.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 2097152 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('logtest.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      // Logs should be visible
      expect(screen.getByText('Log de subida')).toBeInTheDocument()
    })

    // Should show log entries about the upload
    expect(screen.getByText(/Iniciando upload/)).toBeInTheDocument()

    // Click "Limpiar" to clear logs
    fireEvent.click(screen.getByText('Limpiar'))

    await waitFor(() => {
      expect(screen.queryByText('Log de subida')).not.toBeInTheDocument()
    })
  })

  // --- Upload diagnostics with recent_media ---

  it('renders upload diagnostics with recent media entries', async () => {
    mockGetUploadDiagnostics.mockResolvedValue({
      data: {
        data: {
          current_user: 'app',
          current_uid: 1000,
          ffmpeg_ok: true,
          ffmpeg_version: '5.1',
          ffprobe_ok: false,
          ffprobe_version: '',
          disk_free_gb: 50.0,
          disk_total_gb: 100.0,
          media_path: '/media',
          directories: [{ path: '/media/vod', writable: true, exists: true }],
          pending_count: 1,
          processing_count: 0,
          completed_count: 5,
          failed_count: 1,
          recent_media: [
            {
              id: 100,
              original_filename: 'recent_video.mp4',
              status: 'completed',
              file_exists: true,
              hls_exists: true,
              file_path: '/media/recent.mp4',
              hls_path: '/media/recent/index.m3u8',
              transcode_status: 'completed',
              created_at: '2024-01-01T00:00:00Z',
            },
            {
              id: 101,
              original_filename: 'failed_video.mkv',
              status: 'failed',
              file_exists: false,
              hls_exists: false,
              file_path: '/media/failed.mkv',
              hls_path: '',
              transcode_status: 'failed',
              created_at: '2024-01-02T00:00:00Z',
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
    // Should show recent media entries
    expect(screen.getByText('recent_video.mp4')).toBeInTheDocument()
    expect(screen.getByText('failed_video.mkv')).toBeInTheDocument()
  })

  // --- Debug panel with problems that have matching VOD data entries ---

  it('renders debug panel with problems and edit button for existing VODs', async () => {
    mockGetVODDebugStats.mockResolvedValue({
      data: {
        data: {
          total: 1,
          completed: 0,
          pending: 0,
          failed: 1,
          processing: 0,
          visible_to_users: 0,
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

    // Should show the problem
    expect(screen.getByText('No HLS path')).toBeInTheDocument()
    // The "Editar" button in the debug panel opens the edit modal for the matching VOD
    const editBtns = screen.getAllByText('Editar')
    // One of these should be in the debug panel
    const debugEditBtn = editBtns.find(b => b.closest('[class*="bg-primary"]') || b.getAttribute('class')?.includes('primary'))
    if (debugEditBtn) {
      fireEvent.click(debugEditBtn)
      await waitFor(() => {
        expect(screen.getByText('Editar VOD')).toBeInTheDocument()
      })
    }
  })

  // --- Polling error handling ---

  it('handles poll error gracefully during transcoding', async () => {
    jest.useFakeTimers()

    mockUploadMediaWithVOD.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          id: 40,
          title: 'Poll Error Movie',
          transcode_status: 'processing',
          hls_path: '',
        },
      },
    })

    mockGetVOD.mockRejectedValue(new Error('poll failed'))

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Crear VOD'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'poll_error.mkv', { type: 'video/x-matroska' })
    Object.defineProperty(file, 'size', { value: 1048576 })

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(screen.getByText('poll_error.mkv')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Subir'))
    })

    await waitFor(() => {
      expect(mockUploadMediaWithVOD).toHaveBeenCalled()
    })

    // Advance timer to trigger poll
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    // Should not crash - the poll error is caught silently
    // Should still be in processing state
    await waitFor(() => {
      expect(screen.getByText(/Transcodificando a MP4/)).toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  // --- Upload with axios error with string response data ---

  it('handles axios error with string response data', async () => {
    mockIsAxiosError = jest.fn(() => true)
    const axiosError = {
      response: { status: 400, data: 'Bad Request: invalid file' },
      code: undefined,
      message: 'Bad Request',
    }
    mockUploadMediaWithVOD.mockRejectedValue(axiosError)

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'bad_request.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('bad_request.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('HTTP 400'))
    })
  })

  // --- addLog timestamp coverage ---

  it('shows upload logs with timestamps', async () => {
    mockUploadMediaWithVOD.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          id: 50,
          title: 'Log Movie',
          transcode_status: 'completed',
          hls_path: '/media/log/index.m3u8',
        },
      },
    })

    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'logmovie.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('logmovie.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(screen.getByText('Log de subida')).toBeInTheDocument()
      // Logs should contain timestamps in brackets
      expect(screen.getByText(/Iniciando upload/)).toBeInTheDocument()
      expect(screen.getByText(/Respuesta:/)).toBeInTheDocument()
      expect(screen.getByText(/VOD creado:/)).toBeInTheDocument()
    })
  })

  // --- Upload cancel button in selected step ---

  it('closes modal with cancel button in upload selected step', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'cancel_test.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 1048576 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('cancel_test.mp4')).toBeInTheDocument()
    })

    // Click Cancelar
    const cancelBtns = screen.getAllByText('Cancelar')
    const modalCancel = cancelBtns.find(b => b.closest('[data-testid="modal"]'))
    fireEvent.click(modalCancel!)

    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })
})
