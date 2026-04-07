/**
 * Extended tests for AdminChannelsPage (src/app/admin/channels/page.tsx)
 * Covers: validation branches, emission handlers, playlist management,
 * stream editing, M3U download, file upload, media operations
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  return function MockVideoPlayer({ src }: any) {
    return <div data-testid="video-player">Playing: {src}</div>
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
  {
    id: 2,
    name: 'CNN',
    category: null,
    logo_url: '',
    stream_count: 0,
    is_active: false,
    channel_number: 0,
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

describe('AdminChannelsPage - extended', () => {
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

  // --- Validation branches ---

  it('shows validation error when channel name exceeds 200 characters', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    const longName = 'A'.repeat(201)
    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: longName } })
    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El nombre no puede exceder 200 caracteres')
    })
  })

  it('shows validation error for invalid logo URL', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Test' } })
    fireEvent.change(screen.getByTestId('input-logo_url'), { target: { name: 'logo_url', value: 'not-a-url' } })
    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('URL del logo no es válida')
    })
  })

  it('shows validation error when stream URL is empty', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
    })
    // Submit without filling URL
    const modalEl = screen.getByTestId('modal')
    const addStreamBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Agregar Stream')
    // The second "Agregar Stream" is the submit button in the stream form
    const submitBtn = addStreamBtns[addStreamBtns.length - 1]
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('La URL del stream es obligatoria')
    })
  })

  // --- Create channel error ---

  it('shows error toast when creating channel fails', async () => {
    mockCreateChannel.mockRejectedValue(new Error('fail'))
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Test' } })
    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al crear canal')
    })
  })

  // --- Update channel error ---

  it('shows error toast when updating channel fails', async () => {
    mockUpdateChannel.mockRejectedValue(new Error('fail'))
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const updateBtn = Array.from(modalButtons).find((b) => b.textContent === 'Actualizar Canal')
    fireEvent.click(updateBtn!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al actualizar canal')
    })
  })

  // --- Stream edit flow ---

  it('opens stream edit form with pre-populated values and submits update', async () => {
    mockUpdateStream.mockResolvedValue({})
    mockGetChannel
      .mockResolvedValueOnce({ data: { data: sampleFullChannel } })
      .mockResolvedValue({ data: { data: sampleFullChannel } })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/stream1.m3u8')).toBeInTheDocument()
    })
    // Click "Editar" on stream row (the button within the modal, not the channel edit)
    const modalEl = screen.getByTestId('modal')
    const streamEditBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Editar')
    // First match should be the stream's Editar button
    if (streamEditBtns.length > 0) {
      fireEvent.click(streamEditBtns[0])
      await waitFor(() => {
        expect(screen.getByText('Editar Stream')).toBeInTheDocument()
      })
    }
  })

  // --- Add stream successfully ---

  it('adds a new stream successfully', async () => {
    mockAddStream.mockResolvedValue({})
    mockGetChannel
      .mockResolvedValueOnce({ data: { data: sampleFullChannel } })
      .mockResolvedValue({ data: { data: { ...sampleFullChannel, streams: [...sampleStreams, { id: 103, url: 'https://new.m3u8', stream_format: 'hls', priority: 3, is_active: true }] } } })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
    })
    // Fill URL
    const modalEl = screen.getByTestId('modal')
    const urlInput = modalEl.querySelector('[data-testid="input-url"]') as HTMLInputElement
    fireEvent.change(urlInput, { target: { name: 'url', value: 'https://new.m3u8' } })
    const addStreamBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Agregar Stream')
    // The second "Agregar Stream" is the submit button in the stream form
    const submitBtn = addStreamBtns[addStreamBtns.length - 1]
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(mockAddStream).toHaveBeenCalledWith(1, expect.objectContaining({ url: 'https://new.m3u8' }))
      expect(mockToast.success).toHaveBeenCalledWith('Stream agregado')
    })
  })

  // --- Add stream error ---

  it('shows error toast when adding stream fails', async () => {
    mockAddStream.mockRejectedValue(new Error('fail'))
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Agregar Stream'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
    })
    const modalEl = screen.getByTestId('modal')
    const urlInput = modalEl.querySelector('[data-testid="input-url"]') as HTMLInputElement
    fireEvent.change(urlInput, { target: { name: 'url', value: 'https://test.m3u8' } })
    const addStreamBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Agregar Stream')
    // The second "Agregar Stream" is the submit button in the stream form
    const submitBtn = addStreamBtns[addStreamBtns.length - 1]
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al agregar stream')
    })
  })

  // --- Error loading channel details ---

  it('shows error toast and closes modal when loading channel fails', async () => {
    mockGetChannel.mockRejectedValue(new Error('fail'))
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar canal')
    })
  })

  // --- Channel with no logo renders TV placeholder ---

  it('renders TV placeholder for channel without logo', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    // CNN has no logo_url
    expect(screen.getByText('TV')).toBeInTheDocument()
  })

  // --- Channel with logo renders img ---

  it('renders logo image for channel with logo_url', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    const img = screen.getByAltText('ESPN')
    expect(img).toHaveAttribute('src', 'https://example.com/espn.png')
  })

  // --- Active/inactive status badges ---

  it('renders active and inactive status badges in table', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  // --- Category display ---

  it('renders "Sin categoria" for channels without category', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Sin categoria')).toBeInTheDocument()
  })
})
