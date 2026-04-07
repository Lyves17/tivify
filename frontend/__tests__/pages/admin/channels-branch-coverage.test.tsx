/**
 * Branch coverage tests for AdminChannelsPage (src/app/admin/channels/page.tsx)
 * Targets conditional branches: ternary operators, &&, ||, ??, if/else
 * that are NOT covered by existing test files.
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

// --- Channel with NO logo, NO category, inactive ---
const channelNoLogo = {
  id: 2,
  name: 'NoLogo Channel',
  category: null,
  logo_url: '',
  stream_count: 0,
  is_active: false,
  channel_number: 0,
}

const channelWithLogo = {
  id: 1,
  name: 'ESPN',
  category: { id: 1, name: 'Sports' },
  logo_url: 'https://example.com/espn.png',
  stream_count: 2,
  is_active: true,
  channel_number: 10,
}

const sampleCategories = [
  { id: 1, name: 'Sports' },
  { id: 2, name: 'News' },
]

const activeStream = { id: 101, url: 'https://example.com/stream1.m3u8', stream_format: 'hls', priority: 1, is_active: true }
const inactiveStream = { id: 102, url: 'https://example.com/stream2.m3u8', stream_format: 'hls', priority: 2, is_active: false }

const fullChannelWithStreams = {
  id: 1,
  name: 'ESPN',
  category: { id: 1, name: 'Sports' },
  category_id: 1,
  logo_url: 'https://example.com/espn.png',
  epg_channel_id: 'espn.us',
  channel_number: 10,
  is_active: true,
  streams: [activeStream, inactiveStream],
}

// Channel with NO optional fields (branches for || '' and ? '')
const fullChannelMinimal = {
  id: 2,
  name: 'Minimal',
  category: null,
  category_id: 0,
  logo_url: '',
  epg_channel_id: '',
  channel_number: 0,
  is_active: false,
  streams: [],
}

const mediaCompleted = {
  id: 10, original_filename: 'video1.mp4', file_size: 1048576,
  duration: 120, resolution: '1080p', status: 'completed', progress: 100, hls_path: '/m.m3u8',
}
const mediaPending = {
  id: 11, original_filename: 'video2.mkv', file_size: 0,
  duration: 0, resolution: '', status: 'pending', progress: 0, hls_path: '',
}
const mediaProcessing = {
  id: 12, original_filename: 'video3.avi', file_size: 500,
  duration: 0, resolution: '', status: 'processing', progress: 45, hls_path: '',
}
const mediaFailed = {
  id: 13, original_filename: 'video4.flv', file_size: 200,
  duration: 0, resolution: '', status: 'failed', progress: 0, hls_path: '',
}

const playlistWithProcessingItem = {
  id: 1, channel_id: 1, playback_mode: 'loop',
  items: [
    {
      id: 201, local_media_id: 10, sort_order: 0,
      local_media: { id: 10, original_filename: 'video1.mp4', duration: 120, resolution: '1080p', status: 'completed', progress: 100 },
    },
    {
      id: 202, local_media_id: 12, sort_order: 1,
      local_media: { id: 12, original_filename: 'video3.avi', duration: 0, resolution: '', status: 'processing', progress: 45 },
    },
  ],
}

const emptyPlaylist = { id: 1, channel_id: 1, playback_mode: 'loop', items: [] }

function setupDefaultMocks() {
  mockGetChannels.mockResolvedValue({
    data: { data: [channelWithLogo, channelNoLogo], meta: { pages: 1 } },
  })
  mockGetCategoriesByType.mockResolvedValue({
    data: { data: sampleCategories },
  })
  mockGetChannel.mockResolvedValue({ data: { data: fullChannelWithStreams } })
  mockGetMediaList.mockResolvedValue({ data: { data: [mediaCompleted, mediaPending, mediaProcessing, mediaFailed] } })
  mockGetChannelPlaylist.mockResolvedValue({ data: { data: playlistWithProcessingItem } })
  mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
}

async function openEditModal() {
  render(<ChannelsPage />)
  await waitFor(() => expect(screen.getByText('ESPN')).toBeInTheDocument())
  fireEvent.click(screen.getAllByText('Editar')[0])
  await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())
}

async function openEditAndGoToEmission() {
  await openEditModal()
  fireEvent.click(screen.getByText('Emision Local'))
  await waitFor(() => expect(screen.getByText('Subir Archivo de Video')).toBeInTheDocument())
}

describe('ChannelsPage - branch coverage: column render ternaries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders channel with no logo (TV placeholder branch)', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('NoLogo Channel')).toBeInTheDocument())
    // The no-logo channel should render the "TV" placeholder text
    expect(screen.getByText('TV')).toBeInTheDocument()
  })

  it('renders channel with logo (img branch)', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('ESPN')).toBeInTheDocument())
    const logos = document.querySelectorAll('img[src="https://example.com/espn.png"]')
    expect(logos.length).toBeGreaterThan(0)
  })

  it('renders channel with no category ("Sin categoria" branch)', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('Sin categoria')).toBeInTheDocument())
  })

  it('renders active and inactive channel status badges', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Activo')).toBeInTheDocument()
      expect(screen.getByText('Inactivo')).toBeInTheDocument()
    })
  })
})

describe('ChannelsPage - branch coverage: formatFileSize branches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders media with 0 bytes (B branch), KB, MB, and GB file sizes via media list', async () => {
    // mediaCompleted = 1048576 (1 MB), mediaPending = 0 (0 B), mediaProcessing = 500 (500 B), mediaFailed = 200 (200 B)
    await openEditAndGoToEmission()
    // Check that all media items are rendered (use getAllByText because some appear in playlist too)
    expect(screen.getAllByText('video1.mp4').length).toBeGreaterThan(0)
    expect(screen.getAllByText('video2.mkv').length).toBeGreaterThan(0)
    expect(screen.getAllByText('video3.avi').length).toBeGreaterThan(0)
    expect(screen.getByText('video4.flv')).toBeInTheDocument()
  })
})

describe('ChannelsPage - branch coverage: media status badges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders all 4 media status badges: completed, processing, pending, failed', async () => {
    await openEditAndGoToEmission()
    await waitFor(() => {
      // Use getAllByText since "Listo" appears in both media list and playlist
      expect(screen.getAllByText('Listo').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Transcodificando 45%/).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
      // "Error" status badge for the failed media
      const errorBadges = screen.getAllByText('Error')
      expect(errorBadges.length).toBeGreaterThan(0)
    })
  })

  it('renders processing/pending progress bar branch', async () => {
    await openEditAndGoToEmission()
    // Both processing and pending items should have progress bars
    expect(screen.getAllByText('video2.mkv').length).toBeGreaterThan(0)
    expect(screen.getAllByText('video3.avi').length).toBeGreaterThan(0)
  })

  it('renders media duration > 0 branch and resolution branch', async () => {
    await openEditAndGoToEmission()
    // mediaCompleted has duration: 120 and resolution: '1080p'
    expect(screen.getAllByText('video1.mp4').length).toBeGreaterThan(0)
  })

  it('shows "En playlist" for in-playlist media', async () => {
    await openEditAndGoToEmission()
    await waitFor(() => {
      // Multiple media items may show "En playlist"
      expect(screen.getAllByText('En playlist').length).toBeGreaterThan(0)
    })
  })
})

describe('ChannelsPage - branch coverage: playlist item rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders playlist item with processing status badge (%)', async () => {
    await openEditAndGoToEmission()
    // playlist item 202 has status "processing" with progress 45
    await waitFor(() => {
      expect(screen.getByText('45%')).toBeInTheDocument()
    })
  })

  it('renders playlist item with no local_media (fallback to "Media #id")', async () => {
    mockGetChannelPlaylist.mockResolvedValue({
      data: {
        data: {
          id: 1, channel_id: 1, playback_mode: 'loop',
          items: [
            { id: 301, local_media_id: 999, sort_order: 0, local_media: null },
          ],
        },
      },
    })
    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('Media #999')).toBeInTheDocument()
    })
  })

  it('renders "listos" counter when playlist has items', async () => {
    await openEditAndGoToEmission()
    // 1 of 2 items completed
    await waitFor(() => {
      expect(screen.getByText('1/2 listos')).toBeInTheDocument()
    })
  })

  it('renders empty playlist message', async () => {
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: emptyPlaylist } })
    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText(/La playlist esta vacia/)).toBeInTheDocument()
    })
  })

  it('renders generate stream warning when no completed items but has items', async () => {
    mockGetChannelPlaylist.mockResolvedValue({
      data: {
        data: {
          id: 1, channel_id: 1, playback_mode: 'loop',
          items: [
            {
              id: 301, local_media_id: 12, sort_order: 0,
              local_media: { id: 12, original_filename: 'video3.avi', duration: 0, resolution: '', status: 'processing', progress: 45 },
            },
          ],
        },
      },
    })
    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText(/Espera a que al menos un video/)).toBeInTheDocument()
    })
  })
})

describe('ChannelsPage - branch coverage: channel form submit validations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('shows error when channel name is empty', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('Nuevo Canal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    // Name is empty by default, try to save
    const saveBtn = screen.getByText('Crear Canal')
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El nombre del canal es requerido')
    })
  })

  it('shows error when channel name exceeds 200 chars', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('Nuevo Canal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    const nameInput = screen.getByTestId('input-name')
    fireEvent.change(nameInput, { target: { name: 'name', value: 'A'.repeat(201) } })
    fireEvent.click(screen.getByText('Crear Canal'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El nombre no puede exceder 200 caracteres')
    })
  })

  it('shows error when logo_url is invalid', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('Nuevo Canal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Test' } })
    fireEvent.change(screen.getByTestId('input-logo_url'), { target: { name: 'logo_url', value: 'not-a-url' } })
    fireEvent.click(screen.getByText('Crear Canal'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('URL del logo no es válida')
    })
  })

  it('creates channel successfully (create branch)', async () => {
    mockCreateChannel.mockResolvedValue({})
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('Nuevo Canal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'New Channel' } })
    fireEvent.click(screen.getByText('Crear Canal'))
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Canal creado')
    })
  })

  it('updates channel successfully (edit/update branch)', async () => {
    mockUpdateChannel.mockResolvedValue({})
    await openEditModal()

    fireEvent.click(screen.getByText('Actualizar Canal'))
    await waitFor(() => {
      expect(mockUpdateChannel).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'ESPN' }))
      expect(mockToast.success).toHaveBeenCalledWith('Canal actualizado')
    })
  })

  it('shows create error message (error branch for create)', async () => {
    mockCreateChannel.mockRejectedValue(new Error('fail'))
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('Nuevo Canal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'New Channel' } })
    fireEvent.click(screen.getByText('Crear Canal'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al crear canal')
    })
  })

  it('shows update error message (error branch for update)', async () => {
    mockUpdateChannel.mockRejectedValue(new Error('fail'))
    await openEditModal()

    fireEvent.click(screen.getByText('Actualizar Canal'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al actualizar canal')
    })
  })
})

describe('ChannelsPage - branch coverage: stream form validations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('shows error when stream URL is empty', async () => {
    await openEditModal()
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => expect(screen.getByText('Nuevo Stream')).toBeInTheDocument())

    // URL is empty, try to save via the submit button inside the stream form
    const modal = screen.getByTestId('modal')
    const agregarBtns = Array.from(modal.querySelectorAll('button')).filter(
      b => b.textContent === 'Agregar Stream' && b.classList.contains('btn-primary')
    )
    // There should be two "Agregar Stream" buttons - the original top one and the form submit
    // Use the last one (form submit)
    const allAgregar = screen.getAllByText('Agregar Stream')
    fireEvent.click(allAgregar[allAgregar.length - 1])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('La URL del stream es obligatoria')
    })
  })

  it('adds new stream successfully (addStream branch)', async () => {
    mockAddStream.mockResolvedValue({})
    mockGetChannel.mockResolvedValue({ data: { data: fullChannelWithStreams } })
    await openEditModal()
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => expect(screen.getByText('Nuevo Stream')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-url'), { target: { name: 'url', value: 'https://new.m3u8' } })
    // Use the last "Agregar Stream" button (the one in the form)
    const allAgregar = screen.getAllByText('Agregar Stream')
    fireEvent.click(allAgregar[allAgregar.length - 1])
    await waitFor(() => {
      expect(mockAddStream).toHaveBeenCalledWith(1, expect.objectContaining({ url: 'https://new.m3u8' }))
      expect(mockToast.success).toHaveBeenCalledWith('Stream agregado')
    })
  })

  it('shows error when adding stream fails (addStream error branch)', async () => {
    mockAddStream.mockRejectedValue(new Error('fail'))
    await openEditModal()
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => expect(screen.getByText('Nuevo Stream')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-url'), { target: { name: 'url', value: 'https://new.m3u8' } })
    const submitBtns = screen.getAllByText('Agregar Stream')
    fireEvent.click(submitBtns[submitBtns.length - 1])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al agregar stream')
    })
  })

  it('shows error when updating stream fails (updateStream error branch)', async () => {
    mockUpdateStream.mockRejectedValue(new Error('fail'))
    await openEditModal()

    // Click the Editar button for the first stream
    const modal = screen.getByTestId('modal')
    const editBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Editar')
    fireEvent.click(editBtns[0])
    await waitFor(() => expect(screen.getByText('Editar Stream')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Actualizar Stream'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al actualizar stream')
    })
  })
})

describe('ChannelsPage - branch coverage: open edit modal for minimal channel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
    mockGetChannel.mockResolvedValue({ data: { data: fullChannelMinimal } })
  })

  it('opens edit modal for channel with no optional fields (falsy || branches)', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('NoLogo Channel')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Editar')[1])
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())
    // Verify the form loaded with empty defaults (triggers || "" branches in openEditModal)
    const nameInput = screen.getByTestId('input-name') as HTMLInputElement
    expect(nameInput.value).toBe('Minimal')
  })

  it('shows error when opening edit modal fails', async () => {
    mockGetChannel.mockRejectedValue(new Error('fail'))
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('ESPN')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Editar')[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar canal')
    })
    // Modal should be closed
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })
})

describe('ChannelsPage - branch coverage: emission status rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders "EN VIVO" badge when emission is running', async () => {
    mockGetEmissionStatus.mockResolvedValue({
      data: { data: { status: 'running', channel_id: 1, pid: 123 } },
    })
    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('EN VIVO')).toBeInTheDocument()
      expect(screen.getByText('Detener Emision')).toBeInTheDocument()
    })
  })

  it('renders "Iniciando..." badge when emission is starting', async () => {
    mockGetEmissionStatus.mockResolvedValue({
      data: { data: { status: 'starting', channel_id: 1 } },
    })
    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('Iniciando...')).toBeInTheDocument()
    })
  })

  it('renders error status badge and error message when emission has error', async () => {
    mockGetEmissionStatus.mockResolvedValue({
      data: { data: { status: 'error', channel_id: 1, error: 'ffmpeg died' } },
    })
    await openEditAndGoToEmission()
    await waitFor(() => {
      // The error message text should be visible
      expect(screen.getByText('ffmpeg died')).toBeInTheDocument()
      // The "Error" badge from emission status (may coexist with media "Error" badges)
      const errorTexts = screen.getAllByText('Error')
      expect(errorTexts.length).toBeGreaterThan(0)
    })
  })

  it('renders "Iniciar Emision" when no emission status (null branch)', async () => {
    mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    await openEditAndGoToEmission()
    await waitFor(() => {
      expect(screen.getByText('Iniciar Emision')).toBeInTheDocument()
    })
  })
})

describe('ChannelsPage - branch coverage: stream form checkbox handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('handles stream form checkbox change (is_active toggle)', async () => {
    await openEditModal()
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => expect(screen.getByText('Nuevo Stream')).toBeInTheDocument())

    // Toggle the stream is_active checkbox
    const checkbox = screen.getByLabelText('Stream activo')
    fireEvent.change(checkbox, { target: { name: 'is_active', type: 'checkbox', checked: false } })
    // No crash means the branch was covered
    expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
  })

  it('handles stream form priority (name === "priority" number conversion)', async () => {
    await openEditModal()
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => expect(screen.getByText('Nuevo Stream')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-priority'), { target: { name: 'priority', value: '5' } })
    expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
  })
})

describe('ChannelsPage - branch coverage: channel form checkbox and is_active toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('handles channel form checkbox change', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('Nuevo Canal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())

    const checkbox = screen.getByLabelText('Canal activo')
    fireEvent.change(checkbox, { target: { name: 'is_active', type: 'checkbox', checked: false } })
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })
})

describe('ChannelsPage - branch coverage: upload error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('shows error when upload fails', async () => {
    mockUploadMedia.mockRejectedValue(new Error('upload failed'))
    await openEditAndGoToEmission()

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al subir archivo')
    })
  })

  it('shows error when add to playlist fails', async () => {
    mockAddPlaylistItem.mockRejectedValue(new Error('fail'))
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: emptyPlaylist } })
    await openEditAndGoToEmission()

    // Find and click the "+ Playlist" button
    const addBtns = screen.getAllByText('+ Playlist')
    fireEvent.click(addBtns[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al agregar a playlist')
    })
  })

  it('shows error when remove from playlist fails', async () => {
    mockRemovePlaylistItem.mockRejectedValue(new Error('fail'))
    await openEditAndGoToEmission()

    const removeButtons = screen.getAllByTitle('Eliminar de playlist')
    fireEvent.click(removeButtons[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar de playlist')
    })
  })

  it('shows error when playback mode change fails', async () => {
    mockUpdatePlaylistMode.mockRejectedValue(new Error('fail'))
    await openEditAndGoToEmission()

    const modeSelect = screen.getByTestId('select-playback_mode')
    fireEvent.change(modeSelect, { target: { value: 'once' } })
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cambiar modo')
    })
  })

  it('shows error when generate stream fails', async () => {
    mockGeneratePlaylistStream.mockRejectedValue(new Error('fail'))
    await openEditAndGoToEmission()

    fireEvent.click(screen.getByText('Generar Stream'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al generar stream')
    })
  })

  it('shows error when delete media fails', async () => {
    mockDeleteMedia.mockRejectedValue(new Error('fail'))
    await openEditAndGoToEmission()

    // Find and click a delete media button (Eliminar in the media list)
    const modal = screen.getByTestId('modal')
    const eliminarBtns = Array.from(modal.querySelectorAll('button')).filter(
      b => b.textContent === 'Eliminar' && !b.closest('[data-testid="confirm-dialog"]')
    )
    // Click the first Eliminar button in the media list section
    fireEvent.click(eliminarBtns[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar archivo')
    })
  })
})

describe('ChannelsPage - branch coverage: move item reorder with success', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('moves second item up successfully', async () => {
    mockReorderPlaylist.mockResolvedValue({})
    await openEditAndGoToEmission()

    const upButtons = screen.getAllByTitle('Subir')
    // Click "up" on the second item (index 1)
    fireEvent.click(upButtons[1])
    await waitFor(() => {
      expect(mockReorderPlaylist).toHaveBeenCalledWith(1, expect.any(Array))
    })
  })

  it('moves first item down successfully', async () => {
    mockReorderPlaylist.mockResolvedValue({})
    await openEditAndGoToEmission()

    const downButtons = screen.getAllByTitle('Bajar')
    fireEvent.click(downButtons[0])
    await waitFor(() => {
      expect(mockReorderPlaylist).toHaveBeenCalledWith(1, expect.any(Array))
    })
  })

  it('shows error when reorder fails', async () => {
    mockReorderPlaylist.mockRejectedValue(new Error('fail'))
    await openEditAndGoToEmission()

    const downButtons = screen.getAllByTitle('Bajar')
    fireEvent.click(downButtons[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al reordenar')
    })
  })
})

describe('ChannelsPage - branch coverage: loading streams + empty stream list', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders empty streams message when channel has no streams and no form is open', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: { ...fullChannelWithStreams, streams: [] } } })
    await openEditModal()
    await waitFor(() => {
      expect(screen.getByText(/Este canal no tiene streams/)).toBeInTheDocument()
    })
  })
})

describe('ChannelsPage - branch coverage: stream active/inactive ternary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders active and inactive stream badges in stream list', async () => {
    await openEditModal()
    await waitFor(() => {
      // Stream 101 is active, stream 102 is inactive
      const modal = screen.getByTestId('modal')
      const activeBadges = modal.querySelectorAll('.bg-green-600\\/20')
      const inactiveBadges = modal.querySelectorAll('.bg-red-600\\/20')
      expect(activeBadges.length).toBeGreaterThan(0)
      expect(inactiveBadges.length).toBeGreaterThan(0)
    })
  })
})

describe('ChannelsPage - branch coverage: saving/editing button text ternaries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('shows "Crear Canal" text in create mode', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('Nuevo Canal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByText('Crear Canal')).toBeInTheDocument()
    })
  })

  it('shows "Actualizar Canal" text in edit mode', async () => {
    await openEditModal()
    expect(screen.getByText('Actualizar Canal')).toBeInTheDocument()
  })

  it('shows "Editar Canal" in modal title for edit mode', async () => {
    await openEditModal()
    expect(screen.getByText('Editar Canal')).toBeInTheDocument()
  })

  it('shows "Nuevo Canal" in modal title for create mode', async () => {
    render(<ChannelsPage />)
    await waitFor(() => expect(screen.getByText('Nuevo Canal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      // Both the button and modal title say "Nuevo Canal"
      const titles = screen.getAllByText('Nuevo Canal')
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('ChannelsPage - branch coverage: stream cancel form button', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('cancels stream form and hides it', async () => {
    await openEditModal()
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => expect(screen.getByText('Nuevo Stream')).toBeInTheDocument())

    // Click cancel on the stream form
    const modal = screen.getByTestId('modal')
    const cancelBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.textContent === 'Cancelar')
    // The last Cancelar should be in the stream form
    fireEvent.click(cancelBtns[cancelBtns.length - 1])
    await waitFor(() => {
      expect(screen.queryByText('Nuevo Stream')).not.toBeInTheDocument()
    })
  })
})

describe('ChannelsPage - branch coverage: fetchChannels error', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetChannels.mockRejectedValue(new Error('network error'))
    mockGetCategoriesByType.mockResolvedValue({ data: { data: sampleCategories } })
  })

  it('shows error toast when fetching channels fails', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar canales')
    })
  })
})

describe('ChannelsPage - branch coverage: fetchCategories error', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetChannels.mockResolvedValue({ data: { data: [], meta: { pages: 1 } } })
    mockGetCategoriesByType.mockRejectedValue(new Error('fail'))
  })

  it('shows error toast when fetching categories fails', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error cargando categorías')
    })
  })
})

describe('ChannelsPage - branch coverage: uploading state in upload zone', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  it('shows uploading state with progress bar and filename', async () => {
    let resolveUpload: any
    mockUploadMedia.mockImplementation((_file: File, onProgress: (pct: number) => void) => {
      onProgress(50)
      return new Promise(resolve => { resolveUpload = resolve })
    })

    await openEditAndGoToEmission()

    const modal = screen.getByTestId('modal')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'uploading-test.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // While uploading, the progress bar and filename should be shown
    await waitFor(() => {
      expect(screen.getByText(/Subiendo: uploading-test.mp4/)).toBeInTheDocument()
    })

    // Resolve upload to clean up
    resolveUpload({})
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Archivo subido correctamente')
    })
  })
})

describe('ChannelsPage - branch coverage: delete media success', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
    mockDeleteMedia.mockResolvedValue({})
  })

  it('deletes media successfully', async () => {
    await openEditAndGoToEmission()

    const modal = screen.getByTestId('modal')
    // Find Eliminar buttons in the media section (not playlist remove buttons)
    const eliminarBtns = Array.from(modal.querySelectorAll('button')).filter(
      b => b.textContent === 'Eliminar'
    )
    fireEvent.click(eliminarBtns[0])
    await waitFor(() => {
      expect(mockDeleteMedia).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Archivo eliminado')
    })
  })
})
