/**
 * Extended tests #2 for AdminChannelsPage (src/app/admin/channels/page.tsx)
 * Covers: emisión local tab (file upload, media library, playlist management),
 * stream selection/toggle/M3U download, stream preview, delete stream confirm,
 * emission start/stop, generate stream, playback mode change, move playlist items
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
  {
    id: 11,
    original_filename: 'video2.mkv',
    file_size: 2097152,
    duration: 0,
    resolution: '',
    status: 'processing',
    progress: 45,
    hls_path: '',
  },
  {
    id: 12,
    original_filename: 'video3.avi',
    file_size: 512,
    duration: 60,
    resolution: '',
    status: 'pending',
    progress: 0,
    hls_path: '',
  },
  {
    id: 13,
    original_filename: 'video4.mp4',
    file_size: 3221225472,
    duration: 300,
    resolution: '720p',
    status: 'failed',
    progress: 0,
    hls_path: '',
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

// Helper to open the edit modal and switch to emission tab
async function openEditAndGoToEmission() {
  render(<ChannelsPage />)
  await waitFor(() => {
    expect(screen.getByText('ESPN')).toBeInTheDocument()
  })
  fireEvent.click(screen.getAllByText('Editar')[0])
  await waitFor(() => {
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })
  // Switch to Emision Local tab
  fireEvent.click(screen.getByText('Emision Local'))
  await waitFor(() => {
    expect(screen.getByText('Subir Archivo de Video')).toBeInTheDocument()
  })
}

describe('AdminChannelsPage - extended2 (emisión local + streams)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetChannels.mockResolvedValue({
      data: { data: sampleChannels, meta: { pages: 1 } },
    })
    mockGetCategoriesByType.mockResolvedValue({
      data: { data: sampleCategories },
    })
    mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
    mockGetMediaList.mockResolvedValue({ data: { data: [] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
    mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
  })

  // --- Emisión Local Tab: Media Library ---

  it('shows media library with various statuses in emision tab', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: { ...samplePlaylist, items: [] } } })
    await openEditAndGoToEmission()
    // Should show media items
    expect(screen.getByText('video1.mp4')).toBeInTheDocument()
    expect(screen.getByText('video2.mkv')).toBeInTheDocument()
    expect(screen.getByText('video3.avi')).toBeInTheDocument()
    expect(screen.getByText('video4.mp4')).toBeInTheDocument()
    // Status badges
    expect(screen.getByText('Listo')).toBeInTheDocument()
    expect(screen.getByText(/Transcodificando 45%/)).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('shows empty media library message when no media', async () => {

    await openEditAndGoToEmission()
    expect(screen.getByText(/No hay archivos subidos/)).toBeInTheDocument()
  })

  it('shows "+ Playlist" button for completed media not in playlist', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: { ...samplePlaylist, items: [] } } })

    await openEditAndGoToEmission()
    expect(screen.getByText('+ Playlist')).toBeInTheDocument()
  })

  it('shows "En playlist" badge for media already in playlist', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })

    await openEditAndGoToEmission()
    expect(screen.getByText('En playlist')).toBeInTheDocument()
  })

  it('calls addPlaylistItem when clicking "+ Playlist"', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
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

  it('shows error toast when addPlaylistItem fails', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: { ...samplePlaylist, items: [] } } })
    mockAddPlaylistItem.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    fireEvent.click(screen.getByText('+ Playlist'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al agregar a playlist')
    })
  })

  it('calls deleteMedia when clicking Eliminar on a media item', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: { ...samplePlaylist, items: [] } } })
    mockDeleteMedia.mockResolvedValue({})

    await openEditAndGoToEmission()
    // Find the Eliminar button inside the media library (not the channel delete)
    const modal = screen.getByTestId('modal')
    const eliminarBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Eliminar')
    // The last "Eliminar" should be in the media library
    fireEvent.click(eliminarBtns[eliminarBtns.length - 1])
    await waitFor(() => {
      expect(mockDeleteMedia).toHaveBeenCalledWith(10)
      expect(mockToast.success).toHaveBeenCalledWith('Archivo eliminado')
    })
  })

  it('shows error toast when deleteMedia fails', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: { ...samplePlaylist, items: [] } } })
    mockDeleteMedia.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    const modal = screen.getByTestId('modal')
    const eliminarBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Eliminar')
    fireEvent.click(eliminarBtns[eliminarBtns.length - 1])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar archivo')
    })
  })

  // --- File upload in emisión local ---

  it('uploads a file successfully in emision tab', async () => {
    mockUploadMedia.mockResolvedValue({})

    await openEditAndGoToEmission()
    // Find the hidden file input
    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()
    const file = new File(['video content'], 'test_video.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      expect(mockUploadMedia).toHaveBeenCalledWith(file, expect.any(Function))
      expect(mockToast.success).toHaveBeenCalledWith('Archivo subido correctamente')
    })
  })

  it('shows error toast when file upload fails', async () => {
    mockUploadMedia.mockRejectedValue(new Error('upload fail'))

    await openEditAndGoToEmission()
    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video content'], 'fail.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al subir archivo')
    })
  })

  // --- Playlist section ---

  it('renders playlist with items and action buttons', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })

    await openEditAndGoToEmission()
    // Playlist items should be visible
    expect(screen.getByText('Playlist del Canal')).toBeInTheDocument()
    // Should show completed/total count
    expect(screen.getByText('1/2 listos')).toBeInTheDocument()
  })

  it('shows empty playlist message when no items', async () => {
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: { items: [] } } })

    await openEditAndGoToEmission()
    expect(screen.getByText(/La playlist esta vacia/)).toBeInTheDocument()
  })

  it('removes item from playlist when clicking remove button', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockRemovePlaylistItem.mockResolvedValue({})

    await openEditAndGoToEmission()
    // Click the "✕" remove button (there should be one per playlist item)
    const removeButtons = screen.getAllByTitle('Eliminar de playlist')
    fireEvent.click(removeButtons[0])
    await waitFor(() => {
      expect(mockRemovePlaylistItem).toHaveBeenCalledWith(1, 201)
      expect(mockToast.success).toHaveBeenCalledWith('Eliminado de la playlist')
    })
  })

  it('shows error when removing playlist item fails', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockRemovePlaylistItem.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    const removeButtons = screen.getAllByTitle('Eliminar de playlist')
    fireEvent.click(removeButtons[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar de playlist')
    })
  })

  it('moves playlist item down', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockReorderPlaylist.mockResolvedValue({})

    await openEditAndGoToEmission()
    // Click the down arrow on first item
    const downButtons = screen.getAllByTitle('Bajar')
    fireEvent.click(downButtons[0])
    await waitFor(() => {
      expect(mockReorderPlaylist).toHaveBeenCalledWith(1, expect.arrayContaining([
        expect.objectContaining({ id: 202, sort_order: 0 }),
        expect.objectContaining({ id: 201, sort_order: 1 }),
      ]))
    })
  })

  it('moves playlist item up', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockReorderPlaylist.mockResolvedValue({})

    await openEditAndGoToEmission()
    // Click up arrow on second item (first up is disabled since index=0)
    const upButtons = screen.getAllByTitle('Subir')
    fireEvent.click(upButtons[1])
    await waitFor(() => {
      expect(mockReorderPlaylist).toHaveBeenCalledWith(1, expect.any(Array))
    })
  })

  it('shows error when reorder fails', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockReorderPlaylist.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    const downButtons = screen.getAllByTitle('Bajar')
    fireEvent.click(downButtons[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al reordenar')
    })
  })

  it('changes playback mode', async () => {
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockUpdatePlaylistMode.mockResolvedValue({})

    await openEditAndGoToEmission()
    // Change the playback_mode select
    const modeSelect = screen.getByTestId('select-playback_mode')
    fireEvent.change(modeSelect, { target: { value: 'shuffle' } })
    await waitFor(() => {
      expect(mockUpdatePlaylistMode).toHaveBeenCalledWith(1, 'shuffle')
      expect(mockToast.success).toHaveBeenCalledWith('Modo actualizado')
    })
  })

  it('shows error when changing playback mode fails', async () => {
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockUpdatePlaylistMode.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    const modeSelect = screen.getByTestId('select-playback_mode')
    fireEvent.change(modeSelect, { target: { value: 'once' } })
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cambiar modo')
    })
  })

  // --- Generate Stream ---

  it('generates stream from playlist successfully', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockGeneratePlaylistStream.mockResolvedValue({})
    mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })

    await openEditAndGoToEmission()
    fireEvent.click(screen.getByText('Generar Stream'))
    await waitFor(() => {
      expect(mockGeneratePlaylistStream).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Stream generado correctamente')
    })
  })

  it('shows error when generating stream fails', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockGeneratePlaylistStream.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    fireEvent.click(screen.getByText('Generar Stream'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al generar stream')
    })
  })

  // --- Emission start/stop ---

  it('starts emission successfully', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockStartEmission.mockResolvedValue({})

    await openEditAndGoToEmission()
    fireEvent.click(screen.getByText('Iniciar Emision'))
    await waitFor(() => {
      expect(mockStartEmission).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Emision iniciada')
    })
  })

  it('shows error when starting emission fails', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockStartEmission.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    fireEvent.click(screen.getByText('Iniciar Emision'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al iniciar emision')
    })
  })

  it('stops emission when running', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockGetEmissionStatus.mockResolvedValue({ data: { data: { status: 'running', error: null } } })
    mockStopEmission.mockResolvedValue({})
    mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })

    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('EN VIVO')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Detener Emision'))
    await waitFor(() => {
      expect(mockStopEmission).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Emision detenida')
    })
  })

  it('shows error when stopping emission fails', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockGetEmissionStatus.mockResolvedValue({ data: { data: { status: 'running', error: null } } })
    mockStopEmission.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('EN VIVO')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Detener Emision'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al detener emision')
    })
  })

  it('shows "Iniciando..." status for starting emission', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockGetEmissionStatus.mockResolvedValue({ data: { data: { status: 'starting', error: null } } })

    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('Iniciando...')).toBeInTheDocument()
    })
  })

  it('shows error status and error message for emission', async () => {
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockGetEmissionStatus.mockResolvedValue({ data: { data: { status: 'error', error: 'ffmpeg crashed' } } })

    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('ffmpeg crashed')).toBeInTheDocument()
    })
  })

  // --- Stream selection, M3U download, preview ---

  it('toggles individual stream selection checkbox', async () => {

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/stream1.m3u8')).toBeInTheDocument()
    })
    // Find stream checkboxes (not the "Todos" checkbox)
    const modal = screen.getByTestId('modal')
    const checkboxes = modal.querySelectorAll('input[type="checkbox"]')
    // First checkbox is is_active for channel, then "Todos", then individual stream checkboxes
    // Let's use the stream checkboxes - they should be after the channel form
    const streamCheckboxes = Array.from(checkboxes).filter(cb => {
      // Stream checkboxes don't have a name attribute
      return !cb.getAttribute('name') && !cb.getAttribute('id')
    })
    expect(streamCheckboxes.length).toBeGreaterThanOrEqual(2)
    // Click to select first stream
    fireEvent.click(streamCheckboxes[0])
    // After selection, "Descargar M3U" button should appear
    await waitFor(() => {
      expect(screen.getByText(/Descargar M3U/)).toBeInTheDocument()
    })
  })

  it('toggles all streams with "Todos" checkbox', async () => {

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Todos')).toBeInTheDocument()
    })
    // Find the "Todos" checkbox label and click its checkbox
    const todosLabel = screen.getByText('Todos')
    const todosCheckbox = todosLabel.parentElement?.querySelector('input[type="checkbox"]')
    fireEvent.click(todosCheckbox!)
    await waitFor(() => {
      expect(screen.getByText(/Descargar M3U \(2\)/)).toBeInTheDocument()
    })
    // Toggle off
    fireEvent.click(todosCheckbox!)
    await waitFor(() => {
      expect(screen.queryByText(/Descargar M3U/)).not.toBeInTheDocument()
    })
  })

  it('opens stream preview player when clicking preview button', async () => {

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Click the preview button (▶)
    const previewBtns = screen.getAllByTitle('Previsualizar stream')
    fireEvent.click(previewBtns[0])
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument()
      expect(screen.getByText(/Playing: https:\/\/example\.com\/stream1\.m3u8/)).toBeInTheDocument()
    })
    // Close player
    fireEvent.click(screen.getByText('ClosePlayer'))
    await waitFor(() => {
      expect(screen.queryByTestId('video-player')).not.toBeInTheDocument()
    })
  })

  it('downloads single stream M3U when clicking download button', async () => {

    // Mock URL and document methods
    const mockCreateObjectURL = jest.fn(() => 'blob:test')
    const mockRevokeObjectURL = jest.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    const originalCreateElement = document.createElement.bind(document)
    const mockClick = jest.fn()
    document.createElement = ((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') el.click = mockClick
      return el
    }) as typeof document.createElement

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Click single M3U download button (↓)
    const downloadBtns = screen.getAllByTitle('Descargar .m3u')
    fireEvent.click(downloadBtns[0])
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalled()

    document.createElement = originalCreateElement
  })

  it('downloads selected streams M3U', async () => {

    const mockCreateObjectURL = jest.fn(() => 'blob:test')
    const mockRevokeObjectURL = jest.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    const originalCreateElement = document.createElement.bind(document)
    const mockClick = jest.fn()
    document.createElement = ((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') el.click = mockClick
      return el
    }) as typeof document.createElement

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Select all streams
    const todosLabel = screen.getByText('Todos')
    const todosCheckbox = todosLabel.parentElement?.querySelector('input[type="checkbox"]')
    fireEvent.click(todosCheckbox!)
    await waitFor(() => {
      expect(screen.getByText(/Descargar M3U \(2\)/)).toBeInTheDocument()
    })
    // Click "Descargar M3U (2)"
    fireEvent.click(screen.getByText(/Descargar M3U \(2\)/))
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()

    document.createElement = originalCreateElement
  })

  // --- Delete stream confirm ---

  it('deletes a stream successfully via confirm dialog', async () => {
    mockDeleteStream.mockResolvedValue({})
    // First call loads the edit modal, second call after delete refreshes
    mockGetChannel
      .mockResolvedValueOnce({ data: { data: sampleFullChannel } })
      .mockResolvedValue({ data: { data: { ...sampleFullChannel, streams: [sampleStreams[1]] } } })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/stream1.m3u8')).toBeInTheDocument()
    })
    // Click "Eliminar" on first stream - stream Eliminar buttons are after stream URLs
    const modal = screen.getByTestId('modal')
    const eliminarBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Eliminar')
    // First Eliminar in the streams section
    fireEvent.click(eliminarBtns[0])
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

  it('shows error toast when deleting stream fails', async () => {
    mockDeleteStream.mockRejectedValue(new Error('fail'))

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    const modal = screen.getByTestId('modal')
    const eliminarBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Eliminar')
    fireEvent.click(eliminarBtns[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar stream')
    })
  })

  it('cancels delete stream confirm dialog', async () => {

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    const modal = screen.getByTestId('modal')
    const eliminarBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Eliminar')
    fireEvent.click(eliminarBtns[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
  })

  // --- Update stream ---

  it('updates an existing stream successfully', async () => {
    mockUpdateStream.mockResolvedValue({})
    mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    // Click "Editar" on a stream
    const modal = screen.getByTestId('modal')
    const streamEditBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Editar')
    fireEvent.click(streamEditBtns[0])
    await waitFor(() => {
      expect(screen.getByText('Editar Stream')).toBeInTheDocument()
    })
    // Change URL and submit
    fireEvent.change(screen.getByTestId('input-url'), { target: { name: 'url', value: 'https://updated.m3u8' } })
    const updateBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent === 'Actualizar Stream')
    fireEvent.click(updateBtn!)
    await waitFor(() => {
      expect(mockUpdateStream).toHaveBeenCalledWith(1, 101, expect.objectContaining({ url: 'https://updated.m3u8' }))
      expect(mockToast.success).toHaveBeenCalledWith('Stream actualizado')
    })
  })

  it('shows error when updating stream fails', async () => {
    mockUpdateStream.mockRejectedValue(new Error('fail'))

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    const modal = screen.getByTestId('modal')
    const streamEditBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Editar')
    fireEvent.click(streamEditBtns[0])
    await waitFor(() => {
      expect(screen.getByText('Editar Stream')).toBeInTheDocument()
    })
    const updateBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent === 'Actualizar Stream')
    fireEvent.click(updateBtn!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al actualizar stream')
    })
  })

  // --- Delete channel confirm ---

  it('deletes a channel and shows success toast', async () => {
    mockDeleteChannel.mockResolvedValue({})

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const eliminarBtn = screen.getByText('Eliminar')
    fireEvent.click(eliminarBtn)
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      expect(screen.getByText('Eliminar Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockDeleteChannel).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Canal eliminado')
    })
  })

  it('shows error when deleting channel fails', async () => {
    mockDeleteChannel.mockRejectedValue(new Error('fail'))

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Eliminar'))
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar canal')
    })
  })

  // --- Create channel success ---

  it('creates a channel successfully with all fields', async () => {
    mockCreateChannel.mockResolvedValue({})

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'New Channel' } })
    fireEvent.change(screen.getByTestId('select-category_id'), { target: { name: 'category_id', value: '2' } })
    fireEvent.change(screen.getByTestId('input-logo_url'), { target: { name: 'logo_url', value: 'https://logo.png' } })
    fireEvent.change(screen.getByTestId('input-channel_number'), { target: { name: 'channel_number', value: '5' } })
    const createBtn = Array.from(screen.getByTestId('modal').querySelectorAll('button')).find(b => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Channel',
        category_id: 2,
        logo_url: 'https://logo.png',
        channel_number: 5,
      }))
      expect(mockToast.success).toHaveBeenCalledWith('Canal creado')
    })
  })

  // --- Channel name required validation ---

  it('shows error when channel name is empty', async () => {

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    const createBtn = Array.from(screen.getByTestId('modal').querySelectorAll('button')).find(b => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El nombre del canal es requerido')
    })
  })

  // --- Checkbox handling ---

  it('handles channel is_active checkbox toggle', async () => {
    mockCreateChannel.mockResolvedValue({})

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Test' } })
    // Uncheck the is_active checkbox - need to use click which triggers onChange with correct checked
    const checkbox = screen.getByLabelText('Canal activo') as HTMLInputElement
    fireEvent.click(checkbox)
    const createBtn = Array.from(screen.getByTestId('modal').querySelectorAll('button')).find(b => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({
        is_active: false,
      }))
    })
  })

  // --- Stream form checkbox handling ---

  it('handles stream is_active checkbox toggle', async () => {
    mockAddStream.mockResolvedValue({})
    mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
    })
    // Fill URL
    fireEvent.change(screen.getByTestId('input-url'), { target: { name: 'url', value: 'https://test.m3u8' } })
    // Toggle stream is_active checkbox (click unchecks it)
    const streamCheckbox = screen.getByLabelText('Stream activo')
    fireEvent.click(streamCheckbox)
    // Change priority
    fireEvent.change(screen.getByTestId('input-priority'), { target: { name: 'priority', value: '5' } })
    const modal = screen.getByTestId('modal')
    const submitBtn = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Agregar Stream').pop()
    fireEvent.click(submitBtn!)
    await waitFor(() => {
      expect(mockAddStream).toHaveBeenCalledWith(1, expect.objectContaining({
        url: 'https://test.m3u8',
        priority: 5,
        is_active: false,
      }))
    })
  })

  // --- Cancel stream form ---

  it('cancels the stream form', async () => {

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
    })
    // Click Cancelar in stream form
    const modal = screen.getByTestId('modal')
    const cancelBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Cancelar')
    fireEvent.click(cancelBtns[cancelBtns.length - 1])
    await waitFor(() => {
      expect(screen.queryByText('Nuevo Stream')).not.toBeInTheDocument()
    })
  })

  // --- Fetch categories error ---

  it('handles category loading error', async () => {
    mockGetCategoriesByType.mockRejectedValue(new Error('fail'))

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error cargando categorías')
    })
  })

  // --- formatFileSize utility coverage ---

  it('renders file sizes in different formats via media library', async () => {
    // sampleMedia has various file sizes: 1048576 (1 MB), 2097152 (2 MB), 512 (B), 3221225472 (3 GB)
    mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: { ...samplePlaylist, items: [] } } })

    await openEditAndGoToEmission()
    // Check that different size formats are rendered
    expect(screen.getByText('512 B')).toBeInTheDocument()
    expect(screen.getByText('1.0 MB')).toBeInTheDocument()
    expect(screen.getByText('2.0 MB')).toBeInTheDocument()
    expect(screen.getByText('3.00 GB')).toBeInTheDocument()
  })

  // --- buildFullUrl with relative URL (non-http stream) ---

  it('downloads M3U for a stream with relative URL', async () => {
    const relativeStreamsChannel = {
      ...sampleFullChannel,
      streams: [
        { id: 201, url: '/live/stream.m3u8', stream_format: 'hls', priority: 1, is_active: true },
      ],
    }
    mockGetChannel.mockResolvedValue({ data: { data: relativeStreamsChannel } })

    const mockCreateObjectURL = jest.fn(() => 'blob:test')
    const mockRevokeObjectURL = jest.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    const originalCreateElement = document.createElement.bind(document)
    const mockClick = jest.fn()
    document.createElement = ((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') el.click = mockClick
      return el
    }) as typeof document.createElement

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('/live/stream.m3u8')).toBeInTheDocument()
    })
    const downloadBtns = screen.getAllByTitle('Descargar .m3u')
    fireEvent.click(downloadBtns[0])
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()

    document.createElement = originalCreateElement
  })

  // --- Toggle stream selection: select then deselect ---

  it('toggles stream selection on and off', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    const modal = screen.getByTestId('modal')
    const checkboxes = Array.from(modal.querySelectorAll('input[type="checkbox"]')).filter(cb => {
      return !cb.getAttribute('name') && !cb.getAttribute('id')
    })
    // Select stream
    fireEvent.click(checkboxes[0])
    await waitFor(() => {
      expect(screen.getByText(/Descargar M3U/)).toBeInTheDocument()
    })
    // Deselect the same stream
    fireEvent.click(checkboxes[0])
    await waitFor(() => {
      expect(screen.queryByText(/Descargar M3U/)).not.toBeInTheDocument()
    })
  })

  // --- fetchPlaylist error branch ---

  it('handles fetchPlaylist error gracefully', async () => {
    mockGetChannelPlaylist.mockRejectedValue(new Error('fail'))

    await openEditAndGoToEmission()
    // Should show empty playlist (setPlaylist(null) on error)
    expect(screen.getByText(/La playlist esta vacia/)).toBeInTheDocument()
  })

  // --- fetchEmissionStatus error branch ---

  it('handles fetchEmissionStatus error gracefully', async () => {
    mockGetEmissionStatus.mockRejectedValue(new Error('fail'))
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylist } })
    mockGetMediaList.mockResolvedValue({ data: { data: [sampleMedia[0]] } })

    await openEditAndGoToEmission()
    // Should still render (emission status is null)
    expect(screen.getByText('Iniciar Emision')).toBeInTheDocument()
  })

  // --- File size KB range ---

  it('renders KB file size correctly', async () => {
    const kbMedia = [{
      id: 20,
      original_filename: 'small.mp4',
      file_size: 5120, // 5 KB
      duration: 10,
      resolution: '',
      status: 'completed',
      progress: 100,
      hls_path: '/media/small/index.m3u8',
    }]
    mockGetMediaList.mockResolvedValue({ data: { data: kbMedia } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: { ...samplePlaylist, items: [] } } })

    await openEditAndGoToEmission()
    expect(screen.getByText('5.0 KB')).toBeInTheDocument()
  })
})
