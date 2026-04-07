/**
 * Full coverage tests for AdminChannelsPage (src/app/admin/channels/page.tsx)
 * Covers remaining uncovered lines: 50-53, 182, 204-205, 349, 380, 423, 440, 447,
 * 472, 487, 498, 501, 515, 526, 553, 584, 598, 617-625, 643, 670, 894, 971, 1123
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ChannelsPage from '@/app/admin/channels/page'

jest.mock('@/lib/api')
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
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
jest.mock('@/components/ui/video-player', () => {
  return function MockVideoPlayer({ isOpen, onClose, url, title }: any) {
    if (!isOpen) return null
    return (
      <div data-testid="video-player">
        <span>Playing: {url}</span>
        <span>{title}</span>
        <button onClick={onClose}>ClosePlayer</button>
      </div>
    )
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

const mockGetChannels = adminAPI.getChannels as jest.Mock
const mockGetCategoriesByType = adminAPI.getCategoriesByType as jest.Mock
const mockGetChannel = adminAPI.getChannel as jest.Mock
const mockCreateChannel = adminAPI.createChannel as jest.Mock
const mockUpdateChannel = adminAPI.updateChannel as jest.Mock
const mockDeleteChannel = adminAPI.deleteChannel as jest.Mock
const mockAddStream = adminAPI.addStream as jest.Mock
const mockUpdateStream = adminAPI.updateStream as jest.Mock
const mockDeleteStream = adminAPI.deleteStream as jest.Mock
const mockGetMediaList = adminAPI.getMediaList as jest.Mock
const mockGetChannelPlaylist = adminAPI.getChannelPlaylist as jest.Mock
const mockGetEmissionStatus = adminAPI.getEmissionStatus as jest.Mock
const mockStartEmission = adminAPI.startEmission as jest.Mock
const mockStopEmission = adminAPI.stopEmission as jest.Mock
const mockUploadMedia = adminAPI.uploadMedia as jest.Mock
const mockDeleteMedia = adminAPI.deleteMedia as jest.Mock
const mockAddPlaylistItem = adminAPI.addPlaylistItem as jest.Mock
const mockRemovePlaylistItem = adminAPI.removePlaylistItem as jest.Mock
const mockGeneratePlaylistStream = adminAPI.generatePlaylistStream as jest.Mock
const mockUpdatePlaylistMode = adminAPI.updatePlaylistMode as jest.Mock
const mockReorderPlaylist = adminAPI.reorderPlaylist as jest.Mock

const sampleChannels = [
  {
    id: 1,
    name: 'ESPN',
    category: { id: 1, name: 'Sports' },
    logo_url: 'https://example.com/espn.png',
    stream_count: 2,
    is_active: true,
    channel_number: 10,
  },
]

const sampleCategories = [
  { id: 1, name: 'Sports' },
  { id: 2, name: 'News' },
]

const sampleStreams = [
  { id: 101, url: 'https://example.com/stream1.m3u8', stream_format: 'hls', priority: 1, is_active: true },
  { id: 102, url: 'https://example.com/stream2.m3u8', stream_format: 'hls', priority: 2, is_active: false },
]

const sampleFullChannel = {
  id: 1,
  name: 'ESPN',
  category: { id: 1, name: 'Sports' },
  category_id: 1,
  logo_url: 'https://example.com/espn.png',
  epg_channel_id: 'espn.us',
  channel_number: 10,
  is_active: true,
  streams: sampleStreams,
}

const sampleMedia = [
  {
    id: 10,
    original_filename: 'video1.mp4',
    file_size: 1048576,
    duration: 120,
    resolution: '1080p',
    status: 'completed',
    progress: 100,
    hls_path: '/media/video1/index.m3u8',
  },
]

const samplePlaylist = {
  id: 1,
  channel_id: 1,
  playback_mode: 'loop',
  items: [
    {
      id: 201,
      local_media_id: 10,
      sort_order: 0,
      local_media: {
        id: 10,
        original_filename: 'video1.mp4',
        duration: 120,
        resolution: '1080p',
        status: 'completed',
        progress: 100,
      },
    },
    {
      id: 202,
      local_media_id: 11,
      sort_order: 1,
      local_media: {
        id: 11,
        original_filename: 'video2.mkv',
        duration: 0,
        resolution: '',
        status: 'processing',
        progress: 45,
      },
    },
  ],
}

function setupDefaultMocks() {
  mockGetChannels.mockResolvedValue({
    data: { data: sampleChannels, meta: { pages: 1 } },
  })
  mockGetCategoriesByType.mockResolvedValue({
    data: { data: sampleCategories },
  })
  mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
  mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
  mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
  mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
}

// ====================================================================
// Tests that do NOT need fake timers
// ====================================================================
describe('AdminChannelsPage - full coverage (no timers)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  // Helper: open edit modal for ESPN
  async function openEditModal() {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/stream1.m3u8')).toBeInTheDocument()
    })
  }

  // Helper: open edit modal and switch to emission tab
  async function openEditAndGoToEmission() {
    await openEditModal()
    fireEvent.click(screen.getByText('Emision Local'))
    await waitFor(() => {
      expect(screen.getByText('Subir Archivo de Video')).toBeInTheDocument()
    })
  }

  // ---- Line 349: handleDeleteChannel ----
  it('deletes a channel via confirm dialog', async () => {
    mockDeleteChannel.mockResolvedValue({})
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Eliminar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockDeleteChannel).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Canal eliminado')
    })
  })

  it('shows error when delete channel fails', async () => {
    mockDeleteChannel.mockRejectedValue(new Error('fail'))
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Eliminar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar canal')
    })
  })

  // ---- Line 380: handleStreamSubmit guard (editing === null) ----
  it('does not call stream APIs in create modal (editing is null)', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    expect(mockAddStream).not.toHaveBeenCalled()
  })

  // ---- Line 423: handleDeleteStream ----
  it('deletes a stream via confirm dialog', async () => {
    mockDeleteStream.mockResolvedValue({})
    await openEditModal()

    const modal = screen.getByTestId('modal')
    const streamEliminarBtns = Array.from(modal.querySelectorAll('button')).filter(
      (b) => b.textContent === 'Eliminar'
    )
    expect(streamEliminarBtns.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(streamEliminarBtns[0])

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      expect(screen.getByText('Eliminar Stream')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockDeleteStream).toHaveBeenCalledWith(1, 101)
      expect(mockToast.success).toHaveBeenCalledWith('Stream eliminado')
    })
  })

  it('shows error when deleting stream fails', async () => {
    mockDeleteStream.mockRejectedValue(new Error('fail'))
    await openEditModal()

    const modal = screen.getByTestId('modal')
    const streamEliminarBtns = Array.from(modal.querySelectorAll('button')).filter(
      (b) => b.textContent === 'Eliminar'
    )
    fireEvent.click(streamEliminarBtns[0])

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar stream')
    })
  })

  // ---- Line 440: handleFileUpload guard (no file) ----
  it('handleFileUpload returns early when no file is selected', async () => {
    await openEditAndGoToEmission()
    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [] } })
    expect(mockUploadMedia).not.toHaveBeenCalled()
  })

  // ---- Line 447: uploadMedia call with progress callback ----
  it('invokes uploadMedia progress callback during upload', async () => {
    let capturedProgressCb: ((pct: number) => void) | null = null
    mockUploadMedia.mockImplementation((_file: File, onProgress: (pct: number) => void) => {
      capturedProgressCb = onProgress
      onProgress(50)
      return Promise.resolve({})
    })

    await openEditAndGoToEmission()
    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockUploadMedia).toHaveBeenCalledWith(file, expect.any(Function))
      expect(mockToast.success).toHaveBeenCalledWith('Archivo subido correctamente')
    })
    expect(capturedProgressCb).not.toBeNull()
  })

  // ---- Lines 472, 487: handleAddToPlaylist, handleRemoveFromPlaylist ----
  it('adds media to playlist via + Playlist button', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
    mockGetChannelPlaylist
      .mockResolvedValueOnce({ data: { data: { ...samplePlaylist, items: [] } } })
      .mockResolvedValue({ data: { data: samplePlaylist } })
    mockAddPlaylistItem.mockResolvedValue({})

    await openEditAndGoToEmission()
    fireEvent.click(screen.getByText('+ Playlist'))
    await waitFor(() => {
      expect(mockAddPlaylistItem).toHaveBeenCalledWith(1, expect.objectContaining({ local_media_id: 10 }))
      expect(mockToast.success).toHaveBeenCalledWith('Agregado a la playlist')
    })
  })

  it('removes item from playlist via remove button', async () => {
    mockRemovePlaylistItem.mockResolvedValue({})

    await openEditAndGoToEmission()
    const removeButtons = screen.getAllByTitle('Eliminar de playlist')
    fireEvent.click(removeButtons[0])
    await waitFor(() => {
      expect(mockRemovePlaylistItem).toHaveBeenCalledWith(1, 201)
      expect(mockToast.success).toHaveBeenCalledWith('Eliminado de la playlist')
    })
  })

  // ---- Lines 498, 501: handleMoveItem boundary checks ----
  it('does nothing when moving first item up (boundary)', async () => {
    mockReorderPlaylist.mockResolvedValue({})

    await openEditAndGoToEmission()
    const upButtons = screen.getAllByTitle('Subir')
    fireEvent.click(upButtons[0])
    expect(mockReorderPlaylist).not.toHaveBeenCalled()
  })

  it('does nothing when moving last item down (boundary)', async () => {
    mockReorderPlaylist.mockResolvedValue({})

    await openEditAndGoToEmission()
    const downButtons = screen.getAllByTitle('Bajar')
    fireEvent.click(downButtons[downButtons.length - 1])
    expect(mockReorderPlaylist).not.toHaveBeenCalled()
  })

  // ---- Line 515: handlePlaybackModeChange ----
  it('changes playback mode via select', async () => {
    mockUpdatePlaylistMode.mockResolvedValue({})

    await openEditAndGoToEmission()
    const modeSelect = screen.getByTestId('select-playback_mode')
    fireEvent.change(modeSelect, { target: { value: 'shuffle' } })
    await waitFor(() => {
      expect(mockUpdatePlaylistMode).toHaveBeenCalledWith(1, 'shuffle')
      expect(mockToast.success).toHaveBeenCalledWith('Modo actualizado')
    })
  })

  // ---- Line 526: handleGenerateStream ----
  it('generates stream from playlist', async () => {
    mockGeneratePlaylistStream.mockResolvedValue({})

    await openEditAndGoToEmission()
    fireEvent.click(screen.getByText('Generar Stream'))
    await waitFor(() => {
      expect(mockGeneratePlaylistStream).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Stream generado correctamente')
    })
  })

  // ---- Lines 583-594: handleStartEmission ----
  it('starts emission successfully', async () => {
    mockStartEmission.mockResolvedValue({})

    await openEditAndGoToEmission()
    fireEvent.click(screen.getByText('Iniciar Emision'))
    await waitFor(() => {
      expect(mockStartEmission).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Emision iniciada')
    })
  })

  it('shows error when starting emission fails', async () => {
    mockStartEmission.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    fireEvent.click(screen.getByText('Iniciar Emision'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al iniciar emision')
    })
  })

  // ---- Lines 597-613: handleStopEmission ----
  it('stops emission successfully', async () => {
    mockStopEmission.mockResolvedValue({})
    mockGetEmissionStatus.mockResolvedValue({
      data: { data: { status: 'running', channel_id: 1, pid: 123 } },
    })

    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('Detener Emision')).toBeInTheDocument()
    })

    mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    fireEvent.click(screen.getByText('Detener Emision'))
    await waitFor(() => {
      expect(mockStopEmission).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Emision detenida')
    })
  })

  it('shows error when stopping emission fails', async () => {
    mockStopEmission.mockRejectedValue(new Error('fail'))
    mockGetEmissionStatus.mockResolvedValue({
      data: { data: { status: 'running', channel_id: 1, pid: 123 } },
    })

    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('Detener Emision')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Detener Emision'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al detener emision')
    })
  })

  // ---- Lines 617-625, 971: toggleStreamSelection ----
  it('toggles stream selection via checkbox (select then deselect)', async () => {
    await openEditModal()
    const modal = screen.getByTestId('modal')

    const checkboxes = Array.from(modal.querySelectorAll('input[type="checkbox"]'))
    const streamCheckboxes = checkboxes.filter((cb) => !(cb as HTMLInputElement).id)
    expect(streamCheckboxes.length).toBeGreaterThanOrEqual(2)

    // Select first stream
    fireEvent.click(streamCheckboxes[0])
    await waitFor(() => {
      expect(screen.getByText(/Descargar M3U/)).toBeInTheDocument()
    })

    // Deselect it
    fireEvent.click(streamCheckboxes[0])
    await waitFor(() => {
      expect(screen.queryByText(/Descargar M3U/)).not.toBeInTheDocument()
    })
  })

  // ---- Line 894: tab switching ----
  it('switches between Streams Externos and Emision Local tabs', async () => {
    await openEditModal()

    expect(screen.getByText('https://example.com/stream1.m3u8')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Emision Local'))
    await waitFor(() => {
      expect(screen.getByText('Subir Archivo de Video')).toBeInTheDocument()
    })

    // Switch back to streams tab (line 894)
    fireEvent.click(screen.getByText('Streams Externos'))
    await waitFor(() => {
      expect(screen.getByText('https://example.com/stream1.m3u8')).toBeInTheDocument()
    })
  })

  // ---- Line 1123: click upload zone ----
  it('clicks the upload zone to trigger file input click', async () => {
    await openEditAndGoToEmission()

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = jest.spyOn(fileInput, 'click')

    const uploadText = screen.getByText('Click para seleccionar archivo')
    const uploadZone = uploadText.closest('div[class*="border-dashed"]') || uploadText.parentElement?.parentElement
    expect(uploadZone).toBeTruthy()
    fireEvent.click(uploadZone!)

    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  // ---- Stream edit form: update existing stream ----
  it('updates an existing stream via edit form', async () => {
    mockUpdateStream.mockResolvedValue({})
    await openEditModal()

    const modal = screen.getByTestId('modal')
    const allEditBtns = Array.from(modal.querySelectorAll('button')).filter(
      (b) => b.textContent === 'Editar'
    )
    fireEvent.click(allEditBtns[0])
    await waitFor(() => {
      expect(screen.getByText('Editar Stream')).toBeInTheDocument()
    })

    const urlInput = screen.getByTestId('input-url') as HTMLInputElement
    fireEvent.change(urlInput, { target: { name: 'url', value: 'https://updated.m3u8' } })
    fireEvent.click(screen.getByText('Actualizar Stream'))
    await waitFor(() => {
      expect(mockUpdateStream).toHaveBeenCalledWith(1, 101, expect.objectContaining({ url: 'https://updated.m3u8' }))
      expect(mockToast.success).toHaveBeenCalledWith('Stream actualizado')
    })
  })

  // ---- Emission status badges ----
  it('shows starting status indicator for emission', async () => {
    mockGetEmissionStatus.mockResolvedValue({
      data: { data: { status: 'starting', channel_id: 1 } },
    })

    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('Iniciando...')).toBeInTheDocument()
    })
  })

  it('shows error status and message for emission', async () => {
    mockGetEmissionStatus.mockResolvedValue({
      data: { data: { status: 'error', channel_id: 1, error: 'ffmpeg crashed' } },
    })

    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('ffmpeg crashed')).toBeInTheDocument()
    })
  })

  // ---- Cancel dialogs ----
  it('cancels delete channel via confirm dialog', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Eliminar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
    expect(mockDeleteChannel).not.toHaveBeenCalled()
  })

  it('cancels stream delete via confirm dialog', async () => {
    await openEditModal()
    const modal = screen.getByTestId('modal')
    const streamEliminarBtns = Array.from(modal.querySelectorAll('button')).filter(
      (b) => b.textContent === 'Eliminar'
    )
    fireEvent.click(streamEliminarBtns[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
    expect(mockDeleteStream).not.toHaveBeenCalled()
  })

  // ---- Toggle all streams ----
  it('toggles all streams selection via "Todos" checkbox', async () => {
    await openEditModal()

    const todosLabel = screen.getByText('Todos')
    const todosCheckbox = todosLabel.parentElement?.querySelector('input[type="checkbox"]')
    expect(todosCheckbox).toBeTruthy()

    fireEvent.click(todosCheckbox!)
    await waitFor(() => {
      expect(screen.getByText(/Descargar M3U/)).toBeInTheDocument()
    })

    fireEvent.click(todosCheckbox!)
    await waitFor(() => {
      expect(screen.queryByText(/Descargar M3U/)).not.toBeInTheDocument()
    })
  })

  // ---- Stream preview ----
  it('opens stream preview via play button', async () => {
    await openEditModal()
    const modal = screen.getByTestId('modal')
    const previewBtns = Array.from(modal.querySelectorAll('button')).filter(
      (b) => b.textContent === '▶'
    )
    expect(previewBtns.length).toBeGreaterThan(0)
    fireEvent.click(previewBtns[0])
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument()
    })
  })
})

// ====================================================================
// M3U download tests (isolated to avoid createElement mock leaks)
// ====================================================================
describe('AdminChannelsPage - M3U download tests', () => {
  let origCreateObjectURL: typeof URL.createObjectURL
  let origRevokeObjectURL: typeof URL.revokeObjectURL

  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
    origCreateObjectURL = URL.createObjectURL
    origRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = jest.fn().mockReturnValue('blob:test')
    URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL
    URL.revokeObjectURL = origRevokeObjectURL
  })

  // ---- Line 670: downloadSelectedM3U ----
  it('downloads M3U for selected streams', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/stream1.m3u8')).toBeInTheDocument()
    })

    const modal = screen.getByTestId('modal')
    const checkboxes = Array.from(modal.querySelectorAll('input[type="checkbox"]'))
    const streamCheckboxes = checkboxes.filter((cb) => !(cb as HTMLInputElement).id)
    fireEvent.click(streamCheckboxes[0])

    await waitFor(() => {
      expect(screen.getByText(/Descargar M3U/)).toBeInTheDocument()
    })

    // Mock the anchor element click
    const origAppendChild = document.body.appendChild.bind(document.body)
    const origRemoveChild = document.body.removeChild.bind(document.body)
    const mockClick = jest.fn()
    jest.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      if (node instanceof HTMLAnchorElement) {
        node.click = mockClick
      }
      return origAppendChild(node)
    })
    jest.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => {
      return origRemoveChild(node)
    })

    fireEvent.click(screen.getByText(/Descargar M3U/))
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()

    ;(document.body.appendChild as jest.Mock).mockRestore()
    ;(document.body.removeChild as jest.Mock).mockRestore()
  })

  // ---- Line 643: buildFullUrl with relative URL ----
  it('builds full URL for stream with relative path when downloading M3U', async () => {
    const channelWithRelativeStream = {
      ...sampleFullChannel,
      streams: [
        { id: 201, url: '/local/stream.m3u8', stream_format: 'hls', priority: 1, is_active: true },
      ],
    }
    mockGetChannel.mockResolvedValue({ data: { data: channelWithRelativeStream } })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('/local/stream.m3u8')).toBeInTheDocument()
    })

    const origAppendChild = document.body.appendChild.bind(document.body)
    const origRemoveChild = document.body.removeChild.bind(document.body)
    const mockClick = jest.fn()
    jest.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      if (node instanceof HTMLAnchorElement) {
        node.click = mockClick
      }
      return origAppendChild(node)
    })
    jest.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => {
      return origRemoveChild(node)
    })

    // Click the individual stream download button (↓)
    const modal = screen.getByTestId('modal')
    const downloadBtns = Array.from(modal.querySelectorAll('button')).filter(
      (b) => b.textContent === '↓'
    )
    expect(downloadBtns.length).toBeGreaterThan(0)
    fireEvent.click(downloadBtns[0])

    expect(URL.createObjectURL).toHaveBeenCalled()
    const blobArg = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob
    // Read blob content via FileReader since Blob.text() may not be available in jsdom
    const blobText = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsText(blobArg)
    })
    // The relative URL should have been prefixed with window.location.origin
    expect(blobText).toContain('http://localhost/local/stream.m3u8')

    ;(document.body.appendChild as jest.Mock).mockRestore()
    ;(document.body.removeChild as jest.Mock).mockRestore()
  })
})

// ====================================================================
// Tests that NEED fake timers (polling)
// ====================================================================
describe('AdminChannelsPage - full coverage (with timers)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    setupDefaultMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ---- Lines 182, 204-205: startPolling guard + stopPolling ----
  it('starts media polling for processing items and stops on modal close', async () => {
    mockGetMediaList
      .mockResolvedValueOnce({
        data: {
          data: [
            { id: 10, original_filename: 'v.mp4', status: 'processing', progress: 50, file_size: 1024, duration: 0, resolution: '', hls_path: '' },
          ],
        },
      })
      .mockResolvedValue({
        data: {
          data: [
            { id: 10, original_filename: 'v.mp4', status: 'completed', progress: 100, file_size: 1024, duration: 120, resolution: '1080p', hls_path: '/m.m3u8' },
          ],
        },
      })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    // Wait for channel detail to load so tabs appear
    await waitFor(() => {
      expect(screen.getByText('Emision Local')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Emision Local'))

    await waitFor(() => {
      expect(mockGetMediaList).toHaveBeenCalled()
    })

    const callsBefore = mockGetMediaList.mock.calls.length

    // Advance timer past polling interval (3000ms)
    await act(async () => {
      jest.advanceTimersByTime(3500)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockGetMediaList.mock.calls.length).toBeGreaterThan(callsBefore)

    // Close modal to trigger stopPolling (lines 204-205)
    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  it('startPolling guard prevents duplicate intervals (line 182)', async () => {
    mockGetMediaList.mockResolvedValue({
      data: {
        data: [
          { id: 10, original_filename: 'v.mp4', status: 'processing', progress: 50, file_size: 1024, duration: 0, resolution: '', hls_path: '' },
        ],
      },
    })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('Emision Local')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Emision Local'))

    await waitFor(() => {
      expect(mockGetMediaList).toHaveBeenCalled()
    })

    const callsAfterInit = mockGetMediaList.mock.calls.length

    await act(async () => {
      jest.advanceTimersByTime(3500)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const callsAfterFirstPoll = mockGetMediaList.mock.calls.length
    expect(callsAfterFirstPoll).toBeGreaterThan(callsAfterInit)

    await act(async () => {
      jest.advanceTimersByTime(3500)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const callsAfterSecondPoll = mockGetMediaList.mock.calls.length
    expect(callsAfterSecondPoll - callsAfterFirstPoll).toBeLessThanOrEqual(3)

    fireEvent.click(screen.getByText('Close'))
  })

  // ---- Lines 553, 575-581: emission polling ----
  it('polls emission status when emission is running', async () => {
    // Return "running" from the start to trigger the emission polling useEffect
    mockGetEmissionStatus.mockResolvedValue({
      data: { data: { status: 'running', channel_id: 1, pid: 123 } },
    })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('Emision Local')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Emision Local'))

    // Wait for emission status to be fetched and state to update
    await waitFor(() => {
      expect(mockGetEmissionStatus).toHaveBeenCalledWith(1)
    })

    // Allow the resolved promise to propagate and trigger useEffect that starts polling
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const callsBefore = mockGetEmissionStatus.mock.calls.length

    // Advance timer past emission polling interval (5000ms)
    await act(async () => {
      jest.advanceTimersByTime(5500)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockGetEmissionStatus.mock.calls.length).toBeGreaterThan(callsBefore)

    fireEvent.click(screen.getByText('Close'))
  })

  // ---- Lines 50-53: clearInterval_Safe exercised through lifecycle ----
  it('exercises polling lifecycle fully (clearInterval_Safe)', async () => {
    mockGetMediaList.mockResolvedValue({
      data: {
        data: [
          { id: 10, original_filename: 'v.mp4', status: 'processing', progress: 50, file_size: 1024, duration: 0, resolution: '', hls_path: '' },
        ],
      },
    })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('Emision Local')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Emision Local'))

    await waitFor(() => {
      expect(mockGetMediaList).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })
})
