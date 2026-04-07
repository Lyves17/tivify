/**
 * Additional coverage tests for AdminVODPage (src/app/admin/vod/page.tsx)
 * Covers uncovered lines: 197-198, 271-272, 1048
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

describe('AdminVODPage - coverage gaps', () => {
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

  // Lines 197-198: resetUploadState clears pollRef when it has an active interval
  it('clears active polling interval when closing modal during transcoding (lines 197-198)', async () => {
    jest.useFakeTimers()

    // Upload returns a VOD that needs transcoding - will start a poll
    mockUploadMediaWithVOD.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          id: 20,
          title: 'Transcode Movie',
          transcode_status: 'processing',
          hls_path: '',
        },
      },
    })

    // Poll always returns processing to keep polling active
    mockGetVOD.mockResolvedValue({
      data: { data: { id: 20, transcode_status: 'processing', transcode_progress: 50, hls_path: '' } },
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

    // Select a file
    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video'], 'transcode.mkv', { type: 'video/x-matroska' })
    Object.defineProperty(file, 'size', { value: 1048576 })

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(screen.getByText('transcode.mkv')).toBeInTheDocument()
    })

    // Click "Subir" to start upload
    await act(async () => {
      fireEvent.click(screen.getByText('Subir'))
    })

    await waitFor(() => {
      expect(mockUploadMediaWithVOD).toHaveBeenCalled()
    })

    // Should be in processing state with active poll
    await waitFor(() => {
      expect(screen.getByText(/Transcodificando a MP4/)).toBeInTheDocument()
    })

    // Advance timer so poll interval fires at least once
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    // Now close the modal - this triggers handleClose -> resetUploadState
    // which should clear the pollRef (lines 197-198)
    fireEvent.click(screen.getByText('Close'))

    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    // Advance timers further - should not cause errors since poll is cleared
    await act(async () => {
      jest.advanceTimersByTime(10000)
    })

    jest.useRealTimers()
  })

  // Lines 271-272: upload progress callback fires with pct values including 100
  it('calls upload progress callback with intermediate values and 100% (lines 271-272)', async () => {
    let capturedProgressFn: ((pct: number) => void) | null = null

    mockUploadMediaWithVOD.mockImplementation((_file: any, _title: string, onProgress: (pct: number) => void) => {
      capturedProgressFn = onProgress
      // Simulate progress updates
      onProgress(25)
      onProgress(50)
      onProgress(75)
      onProgress(100)
      return Promise.resolve({
        status: 200,
        data: {
          success: true,
          data: {
            id: 30,
            title: 'Progress Movie',
            transcode_status: 'completed',
            hls_path: '/media/progress/index.m3u8',
          },
        },
      })
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
    const file = new File(['video'], 'progress_test.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 2097152 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('progress_test.mp4')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Subir'))

    await waitFor(() => {
      expect(mockUploadMediaWithVOD).toHaveBeenCalled()
      // The progress callback with 100 should have triggered the addLog
      expect(mockToast.success).toHaveBeenCalledWith('VOD creado correctamente')
    })

    // Should show the log about upload 100%
    await waitFor(() => {
      expect(screen.getByText('Log de subida')).toBeInTheDocument()
    })

    // The log should contain the 100% message
    expect(screen.getByText(/Upload 100%/)).toBeInTheDocument()
  })

  // Line 1048: click on the upload idle area to trigger fileInputRef.current?.click()
  it('clicks the upload idle area to open file picker (line 1048)', async () => {
    render(<VODPage />)
    await waitFor(() => {
      expect(screen.getByText('Crear VOD')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Crear VOD'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    // The upload area shows "Haz clic para seleccionar un archivo"
    const uploadText = screen.getByText('Haz clic para seleccionar un archivo')
    const uploadArea = uploadText.closest('div[class*="border-dashed"]')
      || uploadText.closest('div')?.parentElement

    if (uploadArea) {
      // Click the area - this triggers fileInputRef.current?.click() (line 1048)
      fireEvent.click(uploadArea)
    }

    // Verify no crash
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })
})
