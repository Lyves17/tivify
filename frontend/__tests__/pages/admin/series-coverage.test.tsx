/**
 * Additional coverage tests for AdminSeriesPage.
 * Covers uncovered lines:
 *   - Line 313: (pct) => setEpUploadProgress(pct) progress callback
 *   - Line 685: onClick={() => epFileInputRef.current?.click()) on file drop zone
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
const mockGetSeriesEpisodes = adminAPI.getSeriesEpisodes as jest.Mock
const mockUploadMediaWithVOD = adminAPI.uploadMediaWithVOD as jest.Mock

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
]

const sampleCategories = [
  { id: 1, name: 'Drama' },
  { id: 2, name: 'Comedy' },
]

describe('AdminSeriesPage - coverage for progress callback and file drop zone', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })
    mockGetCategoriesByType.mockResolvedValue({
      data: { data: sampleCategories },
    })
  })

  it('invokes progress callback during upload (line 313)', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })
    // Mock uploadMediaWithVOD to call the progress callback
    mockUploadMediaWithVOD.mockImplementation(
      async (_file: any, _title: string, onProgress: (pct: number) => void, _meta: any) => {
        // Call progress callback with different values
        onProgress(25)
        onProgress(50)
        onProgress(100)
        return { data: { data: { id: 100, transcode_status: 'completed' } } }
      }
    )

    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })

    // Open episode manager
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText('Subir episodio')).toBeInTheDocument()
    })

    // Open episode upload modal
    fireEvent.click(screen.getByText('Subir episodio'))
    await waitFor(() => {
      expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument()
    })

    // Select a file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'episode.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      expect(screen.getByTestId('input-title')).toBeInTheDocument()
    })

    // Fill in the title
    fireEvent.change(screen.getByTestId('input-title'), { target: { name: 'title', value: 'Test Episode' } })

    // Submit
    fireEvent.click(screen.getByText('Subir y crear episodio'))

    await waitFor(() => {
      expect(mockUploadMediaWithVOD).toHaveBeenCalledWith(
        file,
        'Test Episode',
        expect.any(Function),
        expect.objectContaining({ series_id: 1 })
      )
      expect(mockToast.success).toHaveBeenCalledWith('Episodio T1E1 creado')
    })
  })

  it('triggers file input click when clicking the drop zone div (line 685)', async () => {
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })

    render(<SeriesPage />)
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })

    // Open episode manager
    const episodeButtons = screen.getAllByTitle('Gestionar episodios')
    fireEvent.click(episodeButtons[0])
    await waitFor(() => {
      expect(screen.getByText('Subir episodio')).toBeInTheDocument()
    })

    // Open episode upload modal
    fireEvent.click(screen.getByText('Subir episodio'))
    await waitFor(() => {
      expect(screen.getByText('Seleccionar archivo de video')).toBeInTheDocument()
    })

    // Find the file input and spy on its click method
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = jest.spyOn(fileInput, 'click')

    // Click the drop zone div (the parent div containing "Seleccionar archivo de video")
    const dropZone = screen.getByText('Seleccionar archivo de video').closest('div[class*="cursor-pointer"]')
    expect(dropZone).toBeInTheDocument()
    fireEvent.click(dropZone!)

    // The file input's click should have been called via the ref
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})
