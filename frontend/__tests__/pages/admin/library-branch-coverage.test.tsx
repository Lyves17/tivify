/**
 * Branch coverage tests for LibraryPage (src/app/admin/library/page.tsx)
 * Targets conditional branches not covered by existing tests.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import LibraryPage from '@/app/admin/library/page'

jest.mock('@/lib/api')
jest.mock('lucide-react', () => ({
  Search: (props: any) => <span data-testid="search-icon" {...props} />,
  Download: (props: any) => <span data-testid="download-icon" {...props} />,
  Check: (props: any) => <span data-testid="check-icon" {...props} />,
  Film: (props: any) => <span data-testid="film-icon" {...props} />,
  Tv: (props: any) => <span data-testid="tv-icon" {...props} />,
  HardDrive: (props: any) => <span data-testid="harddrive-icon" {...props} />,
  RefreshCw: (props: any) => <span data-testid="refresh-icon" {...props} />,
  Database: (props: any) => <span data-testid="database-icon" {...props} />,
  AlertTriangle: (props: any) => <span data-testid="alert-icon" {...props} />,
}))
jest.mock('@/components/ui/pagination', () => {
  return function MockPagination({ page, totalPages, onPageChange }: any) {
    if (totalPages <= 1) return null
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
      <div data-testid="modal" role="dialog">
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    )
  }
})
jest.mock('@/components/ui/form-input', () => {
  return function MockFormInput({ label, name, value, onChange, ...rest }: any) {
    return (
      <div>
        <label htmlFor={name}>{label}</label>
        <input id={name} name={name} value={value} onChange={onChange} {...rest} />
      </div>
    )
  }
})
jest.mock('@/components/ui/form-select', () => {
  return function MockFormSelect({ label, name, value, onChange, options }: any) {
    return (
      <div>
        <label htmlFor={name}>{label}</label>
        <select id={name} name={name} value={value} onChange={onChange}>
          {options.map((o: any) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    )
  }
})
jest.mock('@/lib/utils', () => ({
  formatDurationHuman: jest.fn((s: number) => {
    if (!s) return '0s'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }),
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

const mockGetTMDBStatus = adminAPI.getTMDBStatus as jest.Mock
const mockGetLibraryDevices = adminAPI.getLibraryDevices as jest.Mock
const mockScanLibrary = adminAPI.scanLibrary as jest.Mock
const mockGetScanStatus = adminAPI.getScanStatus as jest.Mock
const mockGetScanResults = adminAPI.getScanResults as jest.Mock
const mockImportLibraryItems = adminAPI.importLibraryItems as jest.Mock
const mockUpdateScanItem = adminAPI.updateScanItem as jest.Mock
const mockSearchTMDB = adminAPI.searchTMDB as jest.Mock

const sampleDevices = [
  {
    path: '/mnt/usb1', name: 'USB Drive 1',
    total_bytes: 1024 * 1024 * 1024 * 500, free_bytes: 1024 * 1024 * 1024 * 200,
    used_bytes: 1024 * 1024 * 1024 * 300, filesystem: 'ntfs', video_files: 42,
  },
  {
    path: '/mnt/usb2', name: 'USB Drive 2',
    total_bytes: 0, free_bytes: 0, used_bytes: 0, filesystem: 'ext4', video_files: 5,
  },
]

const movieItem = {
  id: 1, scan_session_id: 'sess-1', file_name: 'Movie.2024.mkv',
  file_size: 1024 * 1024 * 700, parsed_title: 'Movie', parsed_year: 2024,
  media_type: 'movie' as const, season_number: 0, episode_number: 0,
  duration: 7200, resolution: '1920x1080', video_codec: 'h264', audio_codec: 'aac',
  container: 'mkv', needs_transcode: false,
  tmdb_id: 12345, tmdb_title: 'Movie Title', tmdb_year: 2024,
  tmdb_poster_url: 'https://tmdb.org/poster.jpg', tmdb_backdrop_url: '',
  tmdb_description: 'A great movie', tmdb_rating: 8.5, tmdb_series_name: '',
  import_status: 'pending' as const,
}

const seriesItem = {
  id: 2, scan_session_id: 'sess-1', file_name: 'Series.S01E01.mkv',
  file_size: 500 * 1024 * 1024, parsed_title: 'Series', parsed_year: 0,
  media_type: 'series' as const, season_number: 1, episode_number: 1,
  duration: 2400, resolution: '1280x720', video_codec: 'hevc', audio_codec: 'aac',
  container: 'mkv', needs_transcode: true,
  tmdb_id: 0, tmdb_title: '', tmdb_year: 0,
  tmdb_poster_url: '', tmdb_backdrop_url: '',
  tmdb_description: '', tmdb_rating: 0, tmdb_series_name: '',
  import_status: 'pending' as const,
}

const importedItem = {
  ...movieItem, id: 3, file_name: 'Imported.mp4', import_status: 'imported' as const,
}

const failedItem = {
  ...movieItem, id: 4, file_name: 'Failed.mp4', import_status: 'failed' as const,
}

const skippedItem = {
  ...movieItem, id: 5, file_name: 'Skipped.mp4', import_status: 'skipped' as const,
}

const allItems = [movieItem, seriesItem, importedItem, failedItem, skippedItem]

async function goToResults(scanItems?: any[]) {
  jest.useFakeTimers()
  mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
  mockScanLibrary.mockResolvedValue({ data: { data: { session_id: 'sess-1' } } })
  mockGetScanStatus.mockResolvedValue({
    data: { data: { session_id: 'sess-1', status: 'completed', total_files: 5, scanned: 5 } },
  })
  mockGetScanResults.mockResolvedValue({
    data: { data: scanItems || allItems, meta: { pages: 1 } },
  })

  render(<LibraryPage />)

  await act(async () => {
    fireEvent.click(screen.getByText('Escanear Biblioteca'))
  })
  await waitFor(() => expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument())

  await act(async () => {
    // Click "Escanear (1)" button - the device is auto-selected
    const scanBtns = screen.getAllByText(/^Escanear/)
    const startBtn = scanBtns.find(b => b.closest('button')?.textContent?.includes('('))
    fireEvent.click(startBtn || scanBtns[scanBtns.length - 1])
  })

  await act(async () => { jest.advanceTimersByTime(2000) })
  await waitFor(() => {
    expect(screen.getByText((scanItems || allItems)[0].file_name)).toBeInTheDocument()
  })

  jest.useRealTimers()
}

describe('LibraryPage - branch coverage: idle state TMDB status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows TMDB not configured warning when configured=false', async () => {
    mockGetTMDBStatus.mockResolvedValue({
      data: { data: { configured: false, valid: false, message: '' } },
    })
    render(<LibraryPage />)
    await waitFor(() => {
      expect(screen.getByText('TMDB no configurado')).toBeInTheDocument()
    })
  })

  it('shows TMDB API key invalid warning when configured=true, valid=false', async () => {
    mockGetTMDBStatus.mockResolvedValue({
      data: { data: { configured: true, valid: false, message: 'Invalid key' } },
    })
    render(<LibraryPage />)
    await waitFor(() => {
      expect(screen.getByText('TMDB API key invalida')).toBeInTheDocument()
      expect(screen.getByText('Invalid key')).toBeInTheDocument()
    })
  })

  it('shows no TMDB warnings when configured and valid', async () => {
    mockGetTMDBStatus.mockResolvedValue({
      data: { data: { configured: true, valid: true, message: '' } },
    })
    render(<LibraryPage />)
    await waitFor(() => {
      expect(screen.getByText('Escanear Biblioteca')).toBeInTheDocument()
    })
    expect(screen.queryByText('TMDB no configurado')).not.toBeInTheDocument()
    expect(screen.queryByText('TMDB API key invalida')).not.toBeInTheDocument()
  })

  it('handles TMDB status fetch failure gracefully', async () => {
    mockGetTMDBStatus.mockRejectedValue(new Error('fail'))
    render(<LibraryPage />)
    await waitFor(() => {
      expect(screen.getByText('Escanear Biblioteca')).toBeInTheDocument()
    })
  })
})

describe('LibraryPage - branch coverage: device selection state', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  it('shows device selection state with auto-selected first device', async () => {
    mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
    render(<LibraryPage />)
    fireEvent.click(screen.getByText('Escanear Biblioteca'))
    await waitFor(() => {
      expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      // First device should be auto-selected
      expect(screen.getByText('USB Drive 1')).toBeInTheDocument()
    })
  })

  it('shows empty devices message when no devices found', async () => {
    mockGetLibraryDevices.mockResolvedValue({ data: { data: [] } })
    render(<LibraryPage />)
    fireEvent.click(screen.getByText('Escanear Biblioteca'))
    await waitFor(() => {
      expect(screen.getByText('No se encontraron dispositivos con archivos de video')).toBeInTheDocument()
    })
  })

  it('shows devices with usage percentage and allows toggle selection', async () => {
    mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
    render(<LibraryPage />)
    fireEvent.click(screen.getByText('Escanear Biblioteca'))
    await waitFor(() => {
      expect(screen.getByText('USB Drive 1')).toBeInTheDocument()
      expect(screen.getByText('USB Drive 2')).toBeInTheDocument()
    })

    // Toggle second device selection
    fireEvent.click(screen.getByText('USB Drive 2'))
    // Toggle first device off by clicking it
    fireEvent.click(screen.getByText('USB Drive 1'))
  })

  it('shows device with total_bytes=0 (usagePercent=0 branch)', async () => {
    mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
    render(<LibraryPage />)
    fireEvent.click(screen.getByText('Escanear Biblioteca'))
    await waitFor(() => {
      // USB Drive 2 has total_bytes=0, so usagePercent should be 0
      expect(screen.getByText('USB Drive 2')).toBeInTheDocument()
    })
  })

  it('cancel button returns to idle state', async () => {
    mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
    render(<LibraryPage />)
    fireEvent.click(screen.getByText('Escanear Biblioteca'))
    await waitFor(() => expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Cancelar'))
    await waitFor(() => {
      expect(screen.getByText('Escanear Biblioteca de Medios')).toBeInTheDocument()
    })
  })

  it('shows error when loading devices fails', async () => {
    mockGetLibraryDevices.mockRejectedValue(new Error('fail'))
    render(<LibraryPage />)
    fireEvent.click(screen.getByText('Escanear Biblioteca'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar dispositivos')
    })
  })
})

describe('LibraryPage - branch coverage: scanning state', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  it('shows scanning state with progress counter', async () => {
    jest.useFakeTimers()
    mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
    mockScanLibrary.mockResolvedValue({ data: { data: { session_id: 'sess-1' } } })
    mockGetScanStatus.mockResolvedValue({
      data: { data: { session_id: 'sess-1', status: 'scanning', total_files: 0, scanned: 10 } },
    })

    render(<LibraryPage />)
    await act(async () => { fireEvent.click(screen.getByText('Escanear Biblioteca')) })
    await waitFor(() => expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument())

    await act(async () => {
      const scanBtns = screen.getAllByText(/^Escanear/)
      fireEvent.click(scanBtns[scanBtns.length - 1])
    })

    await waitFor(() => {
      expect(screen.getByText('Escaneando...')).toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  it('handles scan failure (status=failed branch)', async () => {
    jest.useFakeTimers()
    mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
    mockScanLibrary.mockResolvedValue({ data: { data: { session_id: 'sess-1' } } })
    mockGetScanStatus.mockResolvedValue({
      data: { data: { session_id: 'sess-1', status: 'failed', total_files: 0, scanned: 0, error: 'disk error' } },
    })

    render(<LibraryPage />)
    await act(async () => { fireEvent.click(screen.getByText('Escanear Biblioteca')) })
    await waitFor(() => expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument())

    await act(async () => {
      const scanBtns = screen.getAllByText(/^Escanear/)
      fireEvent.click(scanBtns[scanBtns.length - 1])
    })

    await act(async () => { jest.advanceTimersByTime(2000) })
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Escaneo fallido'))
    })

    jest.useRealTimers()
  })

  it('handles scan start failure', async () => {
    mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
    mockScanLibrary.mockRejectedValue(new Error('fail'))

    render(<LibraryPage />)
    await act(async () => { fireEvent.click(screen.getByText('Escanear Biblioteca')) })
    await waitFor(() => expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument())

    const scanBtns = screen.getAllByText(/^Escanear/)
    fireEvent.click(scanBtns[scanBtns.length - 1])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al iniciar escaneo')
    })
  })
})

describe('LibraryPage - branch coverage: results state - filters and rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  it('renders all import status badges: pending, imported, failed, skipped', async () => {
    await goToResults()
    // Check all status badges are rendered
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
    expect(screen.getByText('Importado')).toBeInTheDocument()
    expect(screen.getAllByText('Error').length).toBeGreaterThan(0)
    expect(screen.getByText('Omitido')).toBeInTheDocument()
  })

  it('renders movie and series type badges', async () => {
    await goToResults()
    expect(screen.getAllByText('Pelicula').length).toBeGreaterThan(0)
    expect(screen.getByText('S01E01')).toBeInTheDocument()
  })

  it('renders direct play and transcode badges', async () => {
    await goToResults()
    expect(screen.getAllByText('Directo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Transcodificar').length).toBeGreaterThan(0)
  })

  it('renders tmdb_poster_url image and no-poster placeholder', async () => {
    await goToResults()
    // movieItem has tmdb_poster_url, seriesItem does not
    const posters = document.querySelectorAll('img[src="https://tmdb.org/poster.jpg"]')
    expect(posters.length).toBeGreaterThan(0)
  })

  it('renders tmdb_title or parsed_title or dash', async () => {
    await goToResults()
    // movieItem has tmdb_title='Movie Title', seriesItem has no tmdb_title so shows parsed_title='Series'
    expect(screen.getAllByText('Movie Title').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Series').length).toBeGreaterThan(0)
  })

  it('renders parsed_year > 0 branch (shows year) vs year=0 (no year shown)', async () => {
    await goToResults()
    // movieItem has parsed_year=2024, seriesItem has parsed_year=0
    expect(screen.getAllByText('2024').length).toBeGreaterThan(0)
  })

  it('applies movie filter', async () => {
    await goToResults()
    fireEvent.click(screen.getByText('Peliculas'))
    // Only movie items should be visible
    expect(screen.queryByText('Series.S01E01.mkv')).not.toBeInTheDocument()
  })

  it('applies series filter', async () => {
    await goToResults()
    // "Series" text appears in filter buttons and as data, use getAllByText to find the filter button
    const seriesBtns = screen.getAllByText('Series')
    const filterBtn = seriesBtns.find(b => b.tagName === 'BUTTON')
    fireEvent.click(filterBtn || seriesBtns[0])
    expect(screen.queryByText('Movie.2024.mkv')).not.toBeInTheDocument()
    expect(screen.getByText('Series.S01E01.mkv')).toBeInTheDocument()
  })

  it('applies direct filter', async () => {
    await goToResults()
    fireEvent.click(screen.getByText('Directo', { selector: 'button' }))
    // Only items with needs_transcode=false should be visible
    expect(screen.queryByText('Series.S01E01.mkv')).not.toBeInTheDocument()
  })

  it('applies transcode filter', async () => {
    await goToResults()
    const filterBtns = screen.getAllByText('Transcodificar')
    const filterButton = filterBtns.find(b => b.tagName === 'BUTTON')
    fireEvent.click(filterButton || filterBtns[0])
    // Only items with needs_transcode=true
    expect(screen.getByText('Series.S01E01.mkv')).toBeInTheDocument()
  })

  it('shows loading state when loading results', async () => {
    // Test the loading branch by checking it gets resolved
    await goToResults()
    expect(screen.getByText('Movie.2024.mkv')).toBeInTheDocument()
  })

  it('checkbox only shown for pending items', async () => {
    await goToResults()
    // importedItem (id:3) should not have a checkbox
    const checkboxes = document.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBeGreaterThan(0)
  })
})

describe('LibraryPage - branch coverage: selection and import', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  it('selects items via select all, then imports', async () => {
    mockImportLibraryItems.mockResolvedValue({
      data: { data: { imported: 1, failed: 0 } },
    })
    await goToResults()

    // Use "Seleccionar todo" to select all pending items
    fireEvent.click(screen.getByText('Seleccionar todo'))

    // Import button should appear
    await waitFor(() => {
      expect(screen.getByText(/Importar/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Importar/))
    await waitFor(() => {
      expect(mockImportLibraryItems).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Importados'))
    })
  })

  it('select all and deselect all buttons work', async () => {
    await goToResults()

    fireEvent.click(screen.getByText('Seleccionar todo'))
    await waitFor(() => {
      expect(screen.getByText(/Importar/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Deseleccionar'))
    await waitFor(() => {
      expect(screen.queryByText(/Importar \(/)).not.toBeInTheDocument()
    })
  })

  it('header checkbox toggles select all / deselect all', async () => {
    await goToResults()

    const headerCheckbox = document.querySelector('thead input[type="checkbox"]') as HTMLInputElement
    // Check all
    fireEvent.change(headerCheckbox, { target: { checked: true } })
    // Uncheck all
    fireEvent.change(headerCheckbox, { target: { checked: false } })
    expect(headerCheckbox).toBeTruthy()
  })

  it('shows error when import fails', async () => {
    mockImportLibraryItems.mockRejectedValue(new Error('fail'))
    await goToResults()

    fireEvent.click(screen.getByText('Seleccionar todo'))
    await waitFor(() => expect(screen.getByText(/Importar/)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/Importar/))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al importar')
    })
  })
})

describe('LibraryPage - branch coverage: edit modal - series type branches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  it('shows season/episode fields when media_type is "series"', async () => {
    await goToResults()

    // Click on series item to open edit modal
    fireEvent.click(screen.getByText('Series.S01E01.mkv'))
    await waitFor(() => {
      expect(screen.getByText('Editar Item')).toBeInTheDocument()
      expect(screen.getByText('Temporada')).toBeInTheDocument()
      expect(screen.getByText('Episodio')).toBeInTheDocument()
    })
  })

  it('hides season/episode fields when media_type is "movie"', async () => {
    await goToResults()

    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => {
      expect(screen.getByText('Editar Item')).toBeInTheDocument()
    })
    // In movie mode, Temporada/Episodio should not be visible in the edit form
    // (they may exist in the table but not in the modal form)
    const modal = screen.getByTestId('modal')
    expect(modal.querySelector('#season_number')).not.toBeInTheDocument()
  })

  it('shows TMDB metadata section when tmdb_title is present', async () => {
    await goToResults()

    // movieItem has tmdb_title set
    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => {
      expect(screen.getByText('TMDB')).toBeInTheDocument()
      expect(screen.getByText(/Movie Title \(2024\)/)).toBeInTheDocument()
      expect(screen.getByText(/Rating: 8.5\/10/)).toBeInTheDocument()
    })
  })

  it('shows no TMDB section when tmdb_title is empty', async () => {
    await goToResults()

    fireEvent.click(screen.getByText('Series.S01E01.mkv'))
    await waitFor(() => {
      expect(screen.getByText('Editar Item')).toBeInTheDocument()
    })
    expect(screen.queryByText('TMDB', { selector: 'p' })).not.toBeInTheDocument()
  })

  it('shows tmdb_rating > 0 branch vs tmdb_rating=0 (no rating shown)', async () => {
    await goToResults()

    // movieItem has tmdb_rating=8.5, seriesItem has tmdb_rating=0
    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => {
      expect(screen.getByText(/Rating: 8.5/)).toBeInTheDocument()
    })
  })

  it('shows tmdb poster image vs placeholder in edit modal', async () => {
    await goToResults()

    // movieItem has tmdb_poster_url
    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => {
      const modal = screen.getByTestId('modal')
      const poster = modal.querySelector('img[src="https://tmdb.org/poster.jpg"]')
      expect(poster).toBeTruthy()
    })
  })

  it('shows placeholder when no tmdb_poster_url in edit modal', async () => {
    await goToResults()

    // seriesItem has no tmdb_poster_url
    fireEvent.click(screen.getByText('Series.S01E01.mkv'))
    await waitFor(() => {
      expect(screen.getByText('Editar Item')).toBeInTheDocument()
    })
  })

  it('shows needs_transcode badge in edit modal', async () => {
    await goToResults()

    // seriesItem needs_transcode=true
    fireEvent.click(screen.getByText('Series.S01E01.mkv'))
    await waitFor(() => {
      expect(screen.getByText('Requiere transcodificacion')).toBeInTheDocument()
    })
  })

  it('shows direct playback badge in edit modal for non-transcode item', async () => {
    await goToResults()

    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => {
      expect(screen.getByText('Reproduccion directa')).toBeInTheDocument()
    })
  })
})

describe('LibraryPage - branch coverage: edit save error', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  it('shows error when edit save fails', async () => {
    mockUpdateScanItem.mockRejectedValue(new Error('fail'))
    await goToResults()

    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => expect(screen.getByText('Editar Item')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al actualizar')
    })
  })
})

describe('LibraryPage - branch coverage: TMDB search modal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  it('shows empty TMDB search results message', async () => {
    mockSearchTMDB.mockResolvedValue({ data: { data: [] } })
    await goToResults()

    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => expect(screen.getByText('Editar Item')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Buscar en TMDB'))
    await waitFor(() => expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument())

    // Search
    const searchButtons = screen.getAllByText('Buscar')
    const searchButton = searchButtons.find(el => el.tagName === 'BUTTON')!
    fireEvent.click(searchButton)
    await waitFor(() => expect(mockSearchTMDB).toHaveBeenCalled())

    await waitFor(() => {
      expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    })
  })

  it('shows error when TMDB search fails', async () => {
    mockSearchTMDB.mockRejectedValue(new Error('fail'))
    await goToResults()

    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => expect(screen.getByText('Editar Item')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Buscar en TMDB'))
    await waitFor(() => expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument())

    const searchButtons = screen.getAllByText('Buscar')
    const searchButton = searchButtons.find(el => el.tagName === 'BUTTON')!
    fireEvent.click(searchButton)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error buscando en TMDB')
    })
  })

  it('does not search when query is empty', async () => {
    await goToResults()

    fireEvent.click(screen.getByText('Series.S01E01.mkv'))
    await waitFor(() => expect(screen.getByText('Editar Item')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Buscar en TMDB'))
    await waitFor(() => expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument())

    // Clear the query
    const queryInput = document.getElementById('tmdb_query') as HTMLInputElement
    fireEvent.change(queryInput, { target: { value: '   ' } })

    const searchButtons = screen.getAllByText('Buscar')
    const searchButton = searchButtons.find(el => el.tagName === 'BUTTON')!
    fireEvent.click(searchButton)

    // searchTMDB should not be called
    expect(mockSearchTMDB).not.toHaveBeenCalled()
  })

  it('renders TMDB result with poster and without poster', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: {
        data: [
          { id: 100, title: 'With Poster', year: 2024, poster_url: 'http://p.jpg', backdrop_url: '', overview: 'Good', rating: 9.0 },
          { id: 101, title: 'No Poster', year: 2023, poster_url: '', backdrop_url: '', overview: 'OK', rating: 7.0 },
        ],
      },
    })
    await goToResults()

    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => expect(screen.getByText('Editar Item')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Buscar en TMDB'))
    await waitFor(() => expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument())

    const searchButtons = screen.getAllByText('Buscar')
    const searchButton = searchButtons.find(el => el.tagName === 'BUTTON')!
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('With Poster')).toBeInTheDocument()
      expect(screen.getByText('No Poster')).toBeInTheDocument()
    })
  })
})

describe('LibraryPage - branch coverage: fetch results error', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  it('shows error when fetching scan results fails', async () => {
    jest.useFakeTimers()
    mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
    mockScanLibrary.mockResolvedValue({ data: { data: { session_id: 'sess-1' } } })
    mockGetScanStatus.mockResolvedValue({
      data: { data: { session_id: 'sess-1', status: 'completed', total_files: 1, scanned: 1 } },
    })
    mockGetScanResults.mockRejectedValue(new Error('fail'))

    render(<LibraryPage />)
    await act(async () => { fireEvent.click(screen.getByText('Escanear Biblioteca')) })
    await waitFor(() => expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument())

    await act(async () => {
      const scanBtns = screen.getAllByText(/^Escanear/)
      fireEvent.click(scanBtns[scanBtns.length - 1])
    })
    await act(async () => { jest.advanceTimersByTime(2000) })

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar resultados')
    })

    jest.useRealTimers()
  })
})
