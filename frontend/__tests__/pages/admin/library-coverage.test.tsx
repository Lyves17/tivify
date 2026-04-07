/**
 * Additional coverage tests for LibraryPage.
 * Covers uncovered lines:
 *   - Line 370: checkbox onClick={(e) => e.stopPropagation()} in device selection
 *   - Line 632: edit modal onClose={() => setEditModalOpen(false))
 *   - Lines 695-702: season_number/episode_number onChange handlers for series items
 *   - Line 744: TMDB modal onClose={() => setTmdbModalOpen(false))
 */
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

describe('LibraryPage - additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTMDBStatus.mockResolvedValue({ data: { data: { configured: true, valid: true, message: '' } } })
  })

  async function goToResults(scanItems?: any[]) {
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
    mockGetScanResults.mockResolvedValue({
      data: { data: scanItems || [sampleScanItem], meta: { pages: 1 } },
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
      expect(screen.getByText((scanItems || [sampleScanItem])[0].file_name)).toBeInTheDocument()
    })

    jest.useRealTimers()
    return utils
  }

  it('stops propagation when clicking checkbox in device selection (line 370)', async () => {
    mockGetLibraryDevices.mockResolvedValue({ data: { data: sampleDevices } })

    render(<LibraryPage />)
    fireEvent.click(screen.getByText('Escanear Biblioteca'))
    await waitFor(() => {
      expect(screen.getByText('USB Drive 1')).toBeInTheDocument()
    })

    // Find the checkbox inside the device card
    const checkbox = screen.getAllByRole('checkbox')[0]
    expect(checkbox).toBeInTheDocument()

    // Create a spy on stopPropagation
    const clickEvent = new MouseEvent('click', { bubbles: true })
    const stopSpy = jest.spyOn(clickEvent, 'stopPropagation')

    // Fire native click event (to test stopPropagation)
    checkbox.dispatchEvent(clickEvent)
    expect(stopSpy).toHaveBeenCalled()
  })

  it('closes edit modal via Modal close button (line 632 onClose)', async () => {
    await goToResults()

    // Open edit modal
    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => {
      expect(screen.getByText('Editar Item')).toBeInTheDocument()
    })

    // Click the mock Modal's "Close" button (which triggers onClose prop)
    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByText('Editar Item')).not.toBeInTheDocument()
    })
  })

  it('changes season_number and episode_number in edit modal for series item (lines 695-702)', async () => {
    const seriesItem = {
      ...sampleScanItem,
      id: 2,
      file_name: 'Series.S01E01.mkv',
      media_type: 'series' as const,
      season_number: 1,
      episode_number: 1,
    }

    mockUpdateScanItem.mockResolvedValue({})

    await goToResults([seriesItem])

    // Open edit modal
    fireEvent.click(screen.getByText('Series.S01E01.mkv'))
    await waitFor(() => {
      expect(screen.getByText('Editar Item')).toBeInTheDocument()
    })

    // Season and episode fields should be visible
    const seasonInput = document.getElementById('season_number') as HTMLInputElement
    const episodeInput = document.getElementById('episode_number') as HTMLInputElement
    expect(seasonInput).toBeInTheDocument()
    expect(episodeInput).toBeInTheDocument()

    // Change season_number (line 695)
    fireEvent.change(seasonInput, { target: { value: '3' } })

    // Change episode_number (line 702)
    fireEvent.change(episodeInput, { target: { value: '7' } })

    // Save to verify the values were applied
    fireEvent.click(screen.getByText('Guardar'))

    await waitFor(() => {
      expect(mockUpdateScanItem).toHaveBeenCalledWith(2, expect.objectContaining({
        season_number: 3,
        episode_number: 7,
      }))
    })
  })

  it('closes TMDB search modal via Modal close button (line 744 onClose)', async () => {
    await goToResults()

    // Open edit modal
    fireEvent.click(screen.getByText('Movie.2024.mkv'))
    await waitFor(() => {
      expect(screen.getByText('Editar Item')).toBeInTheDocument()
    })

    // Open TMDB search
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    await waitFor(() => {
      expect(screen.getByText('Buscar en TMDB', { selector: 'h2' })).toBeInTheDocument()
    })

    // Find all "Close" buttons and click the one in the TMDB modal
    // The TMDB modal is the second modal rendered, so get all Close buttons
    const closeButtons = screen.getAllByText('Close')
    // Click the last one (TMDB modal's close)
    fireEvent.click(closeButtons[closeButtons.length - 1])

    await waitFor(() => {
      // TMDB modal title should be gone
      expect(screen.queryByText('Buscar en TMDB', { selector: 'h2' })).not.toBeInTheDocument()
    })
  })
})
