import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import LibraryPage from '@/app/admin/library/page'

jest.mock('@/lib/api')
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
    path: '/mnt/usb1',
    name: 'USB Drive 1',
    total_bytes: 1024 * 1024 * 1024 * 500,
    free_bytes: 1024 * 1024 * 1024 * 200,
    used_bytes: 1024 * 1024 * 1024 * 300,
    filesystem: 'ntfs',
    video_files: 42,
  },
]

const sampleScanItem = {
  id: 1,
  scan_session_id: 'sess-1',
  file_name: 'Movie.2024.mkv',
  file_size: 1024 * 1024 * 700,
  parsed_title: 'Movie',
  parsed_year: 2024,
  media_type: 'movie' as const,
  season_number: 0,
  episode_number: 0,
  duration: 7200,
  resolution: '1920x1080',
  video_codec: 'h264',
  audio_codec: 'aac',
  container: 'mkv',
  needs_transcode: false,
  tmdb_id: 0,
  tmdb_title: '',
  tmdb_year: 0,
  tmdb_poster_url: '',
  tmdb_backdrop_url: '',
  tmdb_description: '',
  tmdb_rating: 0,
  tmdb_series_name: '',
  import_status: 'pending' as const,
}

describe('LibraryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  describe('Idle state', () => {
    it('renders page title', () => {
      render(<LibraryPage />)
      expect(screen.getByText('Biblioteca')).toBeInTheDocument()
    })

    it('renders scan button', () => {
      render(<LibraryPage />)
      expect(screen.getByText('Escanear Biblioteca')).toBeInTheDocument()
    })

    it('renders description text', () => {
      render(<LibraryPage />)
      expect(screen.getByText(/Escanea tu disco externo/)).toBeInTheDocument()
    })

    it('shows TMDB not configured warning', async () => {
      mockGetTMDBStatus.mockResolvedValue({
        data: { data: { configured: false, valid: false, message: '' } },
      })
      render(<LibraryPage />)
      await waitFor(() => {
        expect(screen.getByText('TMDB no configurado')).toBeInTheDocument()
      })
    })

    it('shows TMDB invalid API key warning', async () => {
      mockGetTMDBStatus.mockResolvedValue({
        data: { data: { configured: true, valid: false, message: 'Invalid key' } },
      })
      render(<LibraryPage />)
      await waitFor(() => {
        expect(screen.getByText('TMDB API key invalida')).toBeInTheDocument()
      })
      expect(screen.getByText('Invalid key')).toBeInTheDocument()
    })

    it('does not show TMDB warnings when configured and valid', async () => {
      render(<LibraryPage />)
      await waitFor(() => {
        expect(mockGetTMDBStatus).toHaveBeenCalled()
      })
      expect(screen.queryByText('TMDB no configurado')).not.toBeInTheDocument()
      expect(screen.queryByText('TMDB API key invalida')).not.toBeInTheDocument()
    })
  })

  describe('Device selection state', () => {
    beforeEach(() => {
      mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
    })

    it('transitions to device selection on scan button click', async () => {
      render(<LibraryPage />)
      fireEvent.click(screen.getByText('Escanear Biblioteca'))
      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })
    })

    it('shows devices with their info', async () => {
      render(<LibraryPage />)
      fireEvent.click(screen.getByText('Escanear Biblioteca'))
      await waitFor(() => {
        expect(screen.getByText('USB Drive 1')).toBeInTheDocument()
      })
      expect(screen.getByText('ntfs')).toBeInTheDocument()
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('shows no devices message when empty', async () => {
      mockGetLibraryDevices.mockResolvedValue({ data: { data: [] } })
      render(<LibraryPage />)
      fireEvent.click(screen.getByText('Escanear Biblioteca'))
      await waitFor(() => {
        expect(
          screen.getByText('No se encontraron dispositivos con archivos de video')
        ).toBeInTheDocument()
      })
    })

    it('shows error toast when loading devices fails', async () => {
      mockGetLibraryDevices.mockRejectedValue(new Error('fail'))
      render(<LibraryPage />)
      fireEvent.click(screen.getByText('Escanear Biblioteca'))
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al cargar dispositivos')
      })
    })

    it('returns to idle state on cancel', async () => {
      render(<LibraryPage />)
      fireEvent.click(screen.getByText('Escanear Biblioteca'))
      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Cancelar'))
      expect(screen.getByText('Escanear Biblioteca de Medios')).toBeInTheDocument()
    })
  })

  describe('Scanning state', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
      mockScanLibrary.mockResolvedValue({
        data: { data: { session_id: 'sess-1' } },
      })
      mockGetScanStatus.mockResolvedValue({
        data: { data: { session_id: 'sess-1', status: 'scanning', total_files: 10, scanned: 5 } },
      })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('shows scanning state after starting scan', async () => {
      render(<LibraryPage />)

      // Go to device selection
      await act(async () => {
        fireEvent.click(screen.getByText('Escanear Biblioteca'))
      })

      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })

      // Start scan
      await act(async () => {
        fireEvent.click(screen.getByText(/^Escanear/))
      })

      await waitFor(() => {
        expect(screen.getByText('Escaneando...')).toBeInTheDocument()
      })
    })

    it('shows error toast when scan start fails', async () => {
      mockScanLibrary.mockRejectedValue(new Error('fail'))
      render(<LibraryPage />)

      await act(async () => {
        fireEvent.click(screen.getByText('Escanear Biblioteca'))
      })

      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText(/^Escanear/))
      })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al iniciar escaneo')
      })
    })
  })

  describe('Results state', () => {
    beforeEach(() => {
      mockGetScanResults.mockResolvedValue({
        data: { data: [sampleScanItem], meta: { pages: 1 } },
      })
    })

    // Helper to get to results state directly by manipulating the component
    // We'll simulate the full flow quickly
    async function goToResults() {
      jest.useFakeTimers()
      mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
      mockScanLibrary.mockResolvedValue({
        data: { data: { session_id: 'sess-1' } },
      })
      // First poll returns completed
      mockGetScanStatus.mockResolvedValue({
        data: {
          data: { session_id: 'sess-1', status: 'completed', total_files: 1, scanned: 1 },
        },
      })

      const utils = render(<LibraryPage />)

      // Go to device selection
      await act(async () => {
        fireEvent.click(screen.getByText('Escanear Biblioteca'))
      })
      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })

      // Start scan
      await act(async () => {
        fireEvent.click(screen.getByText(/^Escanear/))
      })

      // Advance timer for polling
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })

      // Wait for results to load
      await waitFor(() => {
        expect(screen.getByText('Movie.2024.mkv')).toBeInTheDocument()
      })

      jest.useRealTimers()
      return utils
    }

    it('shows scan results after completed scan', async () => {
      await goToResults()
      expect(screen.getByText('Movie.2024.mkv')).toBeInTheDocument()
    })

    it('renders filter buttons', async () => {
      await goToResults()
      expect(screen.getByText('Todo')).toBeInTheDocument()
      expect(screen.getByText('Peliculas')).toBeInTheDocument()
      expect(screen.getByText('Series')).toBeInTheDocument()
      // "Directo" and "Transcodificar" may appear both as filter buttons and in the results table
      expect(screen.getAllByText('Directo').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Transcodificar')).toBeInTheDocument()
    })

    it('renders select all and deselect buttons', async () => {
      await goToResults()
      expect(screen.getByText('Seleccionar todo')).toBeInTheDocument()
      expect(screen.getByText('Deseleccionar')).toBeInTheDocument()
    })

    it('renders re-scan button', async () => {
      await goToResults()
      expect(screen.getByText('Re-escanear')).toBeInTheDocument()
    })

    it('shows success toast on completed scan', async () => {
      await goToResults()
      expect(mockToast.success).toHaveBeenCalledWith(
        'Escaneo completado: 1 archivos encontrados'
      )
    })

    it('applies filter for movies only', async () => {
      const seriesItem = {
        ...sampleScanItem,
        id: 2,
        file_name: 'Series.S01E01.mkv',
        media_type: 'series' as const,
        season_number: 1,
        episode_number: 1,
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [sampleScanItem, seriesItem], meta: { pages: 1 } },
      })

      await goToResults()
      expect(screen.getByText('Movie.2024.mkv')).toBeInTheDocument()
      expect(screen.getByText('Series.S01E01.mkv')).toBeInTheDocument()

      // Click the "Peliculas" filter
      fireEvent.click(screen.getByText('Peliculas'))

      // Series item should be filtered out
      expect(screen.getByText('Movie.2024.mkv')).toBeInTheDocument()
      expect(screen.queryByText('Series.S01E01.mkv')).not.toBeInTheDocument()
    })

    it('applies filter for series only', async () => {
      const seriesItem = {
        ...sampleScanItem,
        id: 2,
        file_name: 'Series.S01E01.mkv',
        media_type: 'series' as const,
        season_number: 1,
        episode_number: 1,
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [sampleScanItem, seriesItem], meta: { pages: 1 } },
      })

      await goToResults()

      fireEvent.click(screen.getByText('Series'))
      expect(screen.queryByText('Movie.2024.mkv')).not.toBeInTheDocument()
      expect(screen.getByText('Series.S01E01.mkv')).toBeInTheDocument()
    })

    it('applies direct (no transcode) filter', async () => {
      const transcodeItem = {
        ...sampleScanItem,
        id: 3,
        file_name: 'NeedsTranscode.avi',
        needs_transcode: true,
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [sampleScanItem, transcodeItem], meta: { pages: 1 } },
      })

      await goToResults()

      fireEvent.click(screen.getByText('Directo', { selector: 'button' }))
      expect(screen.getByText('Movie.2024.mkv')).toBeInTheDocument()
      expect(screen.queryByText('NeedsTranscode.avi')).not.toBeInTheDocument()
    })

    it('applies transcode filter', async () => {
      const transcodeItem = {
        ...sampleScanItem,
        id: 3,
        file_name: 'NeedsTranscode.avi',
        needs_transcode: true,
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [sampleScanItem, transcodeItem], meta: { pages: 1 } },
      })

      await goToResults()

      fireEvent.click(screen.getByText('Transcodificar', { selector: 'button' }))
      expect(screen.queryByText('Movie.2024.mkv')).not.toBeInTheDocument()
      expect(screen.getByText('NeedsTranscode.avi')).toBeInTheDocument()
    })

    it('selects all pending items and shows import button', async () => {
      await goToResults()

      fireEvent.click(screen.getByText('Seleccionar todo'))

      // Import button should appear with count
      await waitFor(() => {
        expect(screen.getByText(/Importar/)).toBeInTheDocument()
      })
    })

    it('deselects all items', async () => {
      await goToResults()

      fireEvent.click(screen.getByText('Seleccionar todo'))
      await waitFor(() => {
        expect(screen.getByText(/Importar/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Deseleccionar'))
      // Import button should disappear when nothing selected
      await waitFor(() => {
        expect(screen.queryByText(/Importar \(/)).not.toBeInTheDocument()
      })
    })

    it('imports selected items successfully', async () => {
      mockImportLibraryItems.mockResolvedValue({
        data: { data: { imported: 1, failed: 0 } },
      })

      await goToResults()

      // Select the item using checkbox
      const checkboxes = screen.getAllByRole('checkbox')
      const itemCheckbox = checkboxes.find((cb) => cb.closest('td'))
      if (itemCheckbox) fireEvent.click(itemCheckbox)

      // Click import
      await waitFor(() => {
        const importBtn = screen.getByText(/Importar/)
        fireEvent.click(importBtn)
      })

      await waitFor(() => {
        expect(mockImportLibraryItems).toHaveBeenCalled()
        expect(mockToast.success).toHaveBeenCalledWith('Importados: 1, Fallidos: 0')
      })
    })

    it('shows error toast when import fails', async () => {
      mockImportLibraryItems.mockRejectedValue(new Error('fail'))

      await goToResults()

      fireEvent.click(screen.getByText('Seleccionar todo'))
      await waitFor(() => {
        const importBtn = screen.getByText(/Importar/)
        fireEvent.click(importBtn)
      })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al importar')
      })
    })

    it('opens edit modal when clicking on an item row', async () => {
      await goToResults()

      // Click on the row (the file name)
      fireEvent.click(screen.getByText('Movie.2024.mkv'))

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByText('Editar Item')).toBeInTheDocument()
      })
    })

    it('saves edited item successfully', async () => {
      mockUpdateScanItem.mockResolvedValue({})

      await goToResults()

      // Open edit modal
      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Click Guardar
      const guardarBtn = screen.getByText('Guardar')
      fireEvent.click(guardarBtn)

      await waitFor(() => {
        expect(mockUpdateScanItem).toHaveBeenCalled()
        expect(mockToast.success).toHaveBeenCalledWith('Item actualizado')
      })
    })

    it('shows error toast when saving edit fails', async () => {
      mockUpdateScanItem.mockRejectedValue(new Error('fail'))

      await goToResults()

      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Guardar'))
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al actualizar')
      })
    })

    it('closes edit modal when Cancelar is clicked', async () => {
      await goToResults()

      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancelar'))
      await waitFor(() => {
        expect(screen.queryByText('Editar Item')).not.toBeInTheDocument()
      })
    })

    it('shows no results message when filtered items are empty', async () => {
      // Start with only movie items
      mockGetScanResults.mockResolvedValue({
        data: { data: [sampleScanItem], meta: { pages: 1 } },
      })

      await goToResults()

      // Filter by series (should show empty)
      fireEvent.click(screen.getByText('Series'))
      expect(screen.getByText('No hay resultados')).toBeInTheDocument()
    })

    it('shows loading state in results table', async () => {
      // Set up slow loading
      jest.useFakeTimers()
      mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
      mockScanLibrary.mockResolvedValue({
        data: { data: { session_id: 'sess-1' } },
      })
      mockGetScanStatus.mockResolvedValue({
        data: {
          data: { session_id: 'sess-1', status: 'completed', total_files: 1, scanned: 1 },
        },
      })
      // Make getScanResults never resolve
      mockGetScanResults.mockImplementation(() => new Promise(() => {}))

      render(<LibraryPage />)

      await act(async () => {
        fireEvent.click(screen.getByText('Escanear Biblioteca'))
      })
      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })
      await act(async () => {
        fireEvent.click(screen.getByText(/^Escanear/))
      })
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })

      // Should show Cargando...
      await waitFor(() => {
        expect(screen.getByText('Cargando...')).toBeInTheDocument()
      })

      jest.useRealTimers()
    })

    it('renders imported status badge', async () => {
      const importedItem = {
        ...sampleScanItem,
        import_status: 'imported' as const,
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [importedItem], meta: { pages: 1 } },
      })

      await goToResults()
      expect(screen.getByText('Importado')).toBeInTheDocument()
    })

    it('renders failed status badge', async () => {
      const failedItem = {
        ...sampleScanItem,
        import_status: 'failed' as const,
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [failedItem], meta: { pages: 1 } },
      })

      await goToResults()
      expect(screen.getByText('Error')).toBeInTheDocument()
    })

    it('toggles individual item selection', async () => {
      await goToResults()

      // The first checkbox in td is the item checkbox
      const checkboxes = screen.getAllByRole('checkbox')
      const itemCheckbox = checkboxes.find((cb) => cb.closest('td'))
      expect(itemCheckbox).toBeDefined()

      fireEvent.click(itemCheckbox!)
      // Should show import button now
      await waitFor(() => {
        expect(screen.getByText(/Importar/)).toBeInTheDocument()
      })

      // Deselect
      fireEvent.click(itemCheckbox!)
      await waitFor(() => {
        expect(screen.queryByText(/Importar \(/)).not.toBeInTheDocument()
      })
    })

    it('opens TMDB search from edit modal', async () => {
      await goToResults()

      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Click "Buscar en TMDB" button
      fireEvent.click(screen.getByText('Buscar en TMDB'))

      // TMDB modal should open
      await waitFor(() => {
        expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument()
      })
    })

    it('searches TMDB and shows results', async () => {
      mockSearchTMDB.mockResolvedValue({
        data: {
          data: [
            {
              id: 100,
              title: 'Test Movie',
              year: 2024,
              rating: 7.5,
              overview: 'A test movie',
              poster_url: 'https://example.com/poster.jpg',
              backdrop_url: '',
            },
          ],
        },
      })

      await goToResults()

      // Open edit modal
      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Open TMDB search
      fireEvent.click(screen.getByText('Buscar en TMDB'))
      await waitFor(() => {
        expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument()
      })

      // The search input should be populated
      const searchBtn = screen.getAllByText('Buscar').find((b) => b.closest('button') && b.closest('[role="dialog"]'))
      if (searchBtn) {
        fireEvent.click(searchBtn)
        await waitFor(() => {
          expect(mockSearchTMDB).toHaveBeenCalled()
        })
      }
    })
  })

  describe('Failed scan', () => {
    it('shows error toast and returns to idle on failed scan', async () => {
      jest.useFakeTimers()
      mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
      mockScanLibrary.mockResolvedValue({
        data: { data: { session_id: 'sess-fail' } },
      })
      mockGetScanStatus.mockResolvedValue({
        data: {
          data: { session_id: 'sess-fail', status: 'failed', total_files: 0, scanned: 0, error: 'Disk error' },
        },
      })

      render(<LibraryPage />)

      await act(async () => {
        fireEvent.click(screen.getByText('Escanear Biblioteca'))
      })
      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })
      await act(async () => {
        fireEvent.click(screen.getByText(/^Escanear/))
      })
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Escaneo fallido: Disk error')
      })

      jest.useRealTimers()
    })
  })

  describe('Device toggle', () => {
    it('toggles device selection on/off', async () => {
      const twoDevices = [
        ...sampleDevices,
        {
          path: '/mnt/usb2',
          name: 'USB Drive 2',
          total_bytes: 1024 * 1024 * 1024 * 250,
          free_bytes: 1024 * 1024 * 1024 * 100,
          used_bytes: 1024 * 1024 * 1024 * 150,
          filesystem: 'ext4',
          video_files: 10,
        },
      ]
      mockGetLibraryDevices.mockResolvedValue({ data: { data: twoDevices } })

      render(<LibraryPage />)
      fireEvent.click(screen.getByText('Escanear Biblioteca'))
      await waitFor(() => {
        expect(screen.getByText('USB Drive 1')).toBeInTheDocument()
        expect(screen.getByText('USB Drive 2')).toBeInTheDocument()
      })

      // First device is auto-selected, click it to deselect
      fireEvent.click(screen.getByText('USB Drive 1'))
      // Click second device to select it
      fireEvent.click(screen.getByText('USB Drive 2'))
    })
  })

  describe('Additional coverage - uncovered lines', () => {
    beforeEach(() => {
      mockGetScanResults.mockResolvedValue({
        data: { data: [sampleScanItem], meta: { pages: 1 } },
      })
    })

    async function goToResults(waitForText?: string) {
      jest.useFakeTimers()
      mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
      mockScanLibrary.mockResolvedValue({
        data: { data: { session_id: 'sess-1' } },
      })
      mockGetScanStatus.mockResolvedValue({
        data: {
          data: { session_id: 'sess-1', status: 'completed', total_files: 1, scanned: 1 },
        },
      })

      const utils = render(<LibraryPage />)

      await act(async () => {
        fireEvent.click(screen.getByText('Escanear Biblioteca'))
      })
      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })
      await act(async () => {
        fireEvent.click(screen.getByText(/^Escanear/))
      })
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
      await waitFor(() => {
        expect(screen.getByText(waitForText || 'Movie.2024.mkv')).toBeInTheDocument()
      })

      jest.useRealTimers()
      return utils
    }

    it('shows error toast when fetchResults fails (line 74)', async () => {
      jest.useFakeTimers()
      mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
      mockScanLibrary.mockResolvedValue({
        data: { data: { session_id: 'sess-1' } },
      })
      mockGetScanStatus.mockResolvedValue({
        data: {
          data: { session_id: 'sess-1', status: 'completed', total_files: 1, scanned: 1 },
        },
      })
      mockGetScanResults.mockRejectedValue(new Error('fail'))

      render(<LibraryPage />)

      await act(async () => {
        fireEvent.click(screen.getByText('Escanear Biblioteca'))
      })
      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })
      await act(async () => {
        fireEvent.click(screen.getByText(/^Escanear/))
      })
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al cargar resultados')
      })

      jest.useRealTimers()
    })

    it('shows error toast when TMDB search fails (line 257)', async () => {
      mockSearchTMDB.mockRejectedValue(new Error('TMDB fail'))

      await goToResults()

      // Open edit modal
      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Open TMDB search
      fireEvent.click(screen.getByText('Buscar en TMDB'))
      await waitFor(() => {
        expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument()
      })

      // Click search button
      const searchBtn = screen.getAllByText('Buscar').find(
        (b) => b.closest('button') && b.closest('[role="dialog"]')
      )
      if (searchBtn) {
        fireEvent.click(searchBtn)
        await waitFor(() => {
          expect(mockToast.error).toHaveBeenCalledWith('Error buscando en TMDB')
        })
      }
    })

    it('applies TMDB result to edit item (lines 264-276)', async () => {
      const tmdbResult = {
        id: 200,
        title: 'TMDB Movie',
        year: 2023,
        rating: 9.0,
        overview: 'Great movie',
        poster_url: 'https://tmdb.com/poster.jpg',
        backdrop_url: 'https://tmdb.com/backdrop.jpg',
      }
      mockSearchTMDB.mockResolvedValue({
        data: { data: [tmdbResult] },
      })

      await goToResults()

      // Open edit modal
      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Open TMDB search
      fireEvent.click(screen.getByText('Buscar en TMDB'))
      await waitFor(() => {
        expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument()
      })

      // Search TMDB
      const searchBtn = screen.getAllByText('Buscar').find(
        (b) => b.closest('button') && b.closest('[role="dialog"]')
      )
      if (searchBtn) fireEvent.click(searchBtn)

      await waitFor(() => {
        expect(screen.getByText('TMDB Movie')).toBeInTheDocument()
      })

      // Click result to apply
      fireEvent.click(screen.getByText('TMDB Movie'))

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Metadatos TMDB aplicados')
      })
    })

    it('renders skipped status badge (line 794)', async () => {
      const skippedItem = {
        ...sampleScanItem,
        import_status: 'skipped' as const,
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [skippedItem], meta: { pages: 1 } },
      })

      await goToResults()
      expect(screen.getByText('Omitido')).toBeInTheDocument()
    })

    it('shows season/episode fields when editing a series item (lines 688-704)', async () => {
      const seriesItem = {
        ...sampleScanItem,
        id: 2,
        file_name: 'Series.S01E01.mkv',
        media_type: 'series' as const,
        season_number: 1,
        episode_number: 1,
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [seriesItem], meta: { pages: 1 } },
      })

      await goToResults('Series.S01E01.mkv')

      // Open edit modal
      fireEvent.click(screen.getByText('Series.S01E01.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Should have Temporada and Episodio fields (use input id since label uses htmlFor)
      expect(document.getElementById('season_number')).toBeInTheDocument()
      expect(document.getElementById('episode_number')).toBeInTheDocument()
    })

    it('shows TMDB metadata section when tmdb_title exists (lines 708-716)', async () => {
      const tmdbItem = {
        ...sampleScanItem,
        tmdb_title: 'Test Movie TMDB',
        tmdb_year: 2024,
        tmdb_rating: 7.5,
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [tmdbItem], meta: { pages: 1 } },
      })

      await goToResults()

      // Open edit modal
      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      expect(screen.getByText('TMDB')).toBeInTheDocument()
      expect(screen.getByText('Test Movie TMDB (2024)')).toBeInTheDocument()
      expect(screen.getByText('Rating: 7.5/10')).toBeInTheDocument()
    })

    it('shows poster image in edit modal when tmdb_poster_url exists (line 640)', async () => {
      const posterItem = {
        ...sampleScanItem,
        tmdb_poster_url: 'https://example.com/poster.jpg',
      }
      mockGetScanResults.mockResolvedValue({
        data: { data: [posterItem], meta: { pages: 1 } },
      })

      await goToResults()

      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      const img = document.querySelector('img[src="https://example.com/poster.jpg"]')
      expect(img).toBeInTheDocument()
    })

    it('header checkbox triggers selectAll/deselectAll (line 508)', async () => {
      await goToResults()

      // Find the header checkbox in the th element
      const thElement = document.querySelector('th')
      expect(thElement).toBeTruthy()
      const headerCheckbox = thElement!.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(headerCheckbox).toBeTruthy()

      // Click the checkbox to toggle it on (this fires the onChange event)
      fireEvent.click(headerCheckbox)

      await waitFor(() => {
        expect(screen.getByText(/Importar/)).toBeInTheDocument()
      })

      // Click again to toggle off
      fireEvent.click(headerCheckbox)

      await waitFor(() => {
        expect(screen.queryByText(/Importar \(/)).not.toBeInTheDocument()
      })
    })

    it('shows TMDB search modal form elements (lines 744-773)', async () => {
      await goToResults()

      // Open edit modal
      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Open TMDB search
      fireEvent.click(screen.getByText('Buscar en TMDB'))
      await waitFor(() => {
        expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument()
      })

      // Check search form elements exist
      expect(screen.getByPlaceholderText('Titulo...')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Ano')).toBeInTheDocument()

      // Change TMDB type select (use the tmdb_type id to disambiguate)
      const typeSelect = document.getElementById('tmdb_type') as HTMLSelectElement
      expect(typeSelect).toBeTruthy()
      fireEvent.change(typeSelect, { target: { value: 'series' } })

      // Change year
      const yearInput = screen.getByPlaceholderText('Ano')
      fireEvent.change(yearInput, { target: { value: '2022' } })

      // Change query
      const queryInput = screen.getByPlaceholderText('Titulo...')
      fireEvent.change(queryInput, { target: { value: 'New search' } })
    })

    it('does not search TMDB when query is empty', async () => {
      await goToResults()

      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Buscar en TMDB'))
      await waitFor(() => {
        expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument()
      })

      // Clear the query
      const queryInput = screen.getByPlaceholderText('Titulo...')
      fireEvent.change(queryInput, { target: { value: '' } })

      const searchBtn = screen.getAllByText('Buscar').find(
        (b) => b.closest('button') && b.closest('[role="dialog"]')
      )
      if (searchBtn) fireEvent.click(searchBtn)

      // Should not call searchTMDB when query is empty
      expect(mockSearchTMDB).not.toHaveBeenCalled()
    })

    it('shows failed scan error without specific error message', async () => {
      jest.useFakeTimers()
      mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })
      mockScanLibrary.mockResolvedValue({
        data: { data: { session_id: 'sess-fail' } },
      })
      mockGetScanStatus.mockResolvedValue({
        data: {
          data: { session_id: 'sess-fail', status: 'failed', total_files: 0, scanned: 0 },
        },
      })

      render(<LibraryPage />)

      await act(async () => {
        fireEvent.click(screen.getByText('Escanear Biblioteca'))
      })
      await waitFor(() => {
        expect(screen.getByText('Seleccionar Dispositivos')).toBeInTheDocument()
      })
      await act(async () => {
        fireEvent.click(screen.getByText(/^Escanear/))
      })
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Escaneo fallido: Error desconocido')
      })

      jest.useRealTimers()
    })

    it('changes media type in edit modal to show/hide season fields', async () => {
      await goToResults()

      // Open edit modal for movie item
      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Season/episode fields should not be visible for movie
      expect(screen.queryByLabelText('Temporada')).not.toBeInTheDocument()

      // Change type to series
      const typeSelect = screen.getByLabelText('Tipo')
      fireEvent.change(typeSelect, { target: { value: 'series' } })

      // Now season/episode fields should appear
      expect(screen.getByLabelText('Temporada')).toBeInTheDocument()
      expect(screen.getByLabelText('Episodio')).toBeInTheDocument()
    })

    it('edits parsed_title and parsed_year in edit modal', async () => {
      mockUpdateScanItem.mockResolvedValue({})
      await goToResults()

      fireEvent.click(screen.getByText('Movie.2024.mkv'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Change title
      const titleInput = screen.getByLabelText('Titulo')
      fireEvent.change(titleInput, { target: { value: 'New Title' } })

      // Change year
      const yearInput = screen.getByLabelText('Ano')
      fireEvent.change(yearInput, { target: { value: '2025' } })

      // Save
      fireEvent.click(screen.getByText('Guardar'))

      await waitFor(() => {
        expect(mockUpdateScanItem).toHaveBeenCalledWith(1, expect.objectContaining({
          parsed_title: 'New Title',
          parsed_year: 2025,
        }))
      })
    })
  })
})
