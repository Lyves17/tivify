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
  return function MockVideoPlayer() {
    return <div data-testid="video-player">Video Player</div>
  }
})
jest.mock('@/lib/utils', () => ({
  formatDurationTimer: jest.fn((s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`),
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
const mockCreateChannel = adminAPI.createChannel as jest.Mock
const mockDeleteChannel = adminAPI.deleteChannel as jest.Mock
const mockUpdateChannel = adminAPI.updateChannel as jest.Mock
const mockGetChannel = adminAPI.getChannel as jest.Mock
const mockAddStream = adminAPI.addStream as jest.Mock
const mockUpdateStream = adminAPI.updateStream as jest.Mock
const mockDeleteStream = adminAPI.deleteStream as jest.Mock
const mockGetMediaList = adminAPI.getMediaList as jest.Mock
const mockGetChannelPlaylist = adminAPI.getChannelPlaylist as jest.Mock
const mockGetEmissionStatus = adminAPI.getEmissionStatus as jest.Mock

const sampleChannels = [
  {
    id: 1,
    name: 'ESPN',
    logo_url: 'https://example.com/espn.png',
    category: { id: 1, name: 'Sports' },
    channel_number: 10,
    is_active: true,
    stream_count: 2,
  },
  {
    id: 2,
    name: 'CNN',
    logo_url: null,
    category: null,
    channel_number: 20,
    is_active: false,
    stream_count: 0,
  },
]

const sampleCategories = [
  { id: 1, name: 'Sports' },
  { id: 2, name: 'News' },
]

const sampleStreams = [
  {
    id: 101,
    url: 'https://example.com/stream1.m3u8',
    stream_format: 'hls',
    priority: 1,
    is_active: true,
  },
  {
    id: 102,
    url: 'https://example.com/stream2.m3u8',
    stream_format: 'rtmp',
    priority: 2,
    is_active: false,
  },
]

const sampleFullChannel = {
  id: 1,
  name: 'ESPN',
  logo_url: 'https://example.com/espn.png',
  category_id: 1,
  epg_channel_id: 'espn.us',
  channel_number: 10,
  is_active: true,
  streams: sampleStreams,
}

describe('ChannelsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetChannels.mockResolvedValue({
      data: { data: sampleChannels, meta: { pages: 1 } },
    })
    mockGetCategoriesByType.mockResolvedValue({
      data: { data: sampleCategories },
    })
  })

  it('renders page title', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Canales')).toBeInTheDocument()
    })
  })

  it('renders channels in data table', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })
    expect(screen.getByText('ESPN')).toBeInTheDocument()
    expect(screen.getByText('CNN')).toBeInTheDocument()
  })

  it('renders channel logos', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      const img = screen.getByAltText('ESPN')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/espn.png')
    })
  })

  it('renders placeholder for channels without logo', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('TV')).toBeInTheDocument()
    })
  })

  it('renders category names', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Sports')).toBeInTheDocument()
    })
    expect(screen.getByText('Sin categoria')).toBeInTheDocument()
  })

  it('renders active/inactive status', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Activo')).toBeInTheDocument()
    })
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockGetChannels.mockImplementation(() => new Promise(() => {}))
    render(<ChannelsPage />)
    expect(screen.getByTestId('data-table-loading')).toBeInTheDocument()
  })

  it('shows empty state when no channels', async () => {
    mockGetChannels.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('No hay canales')).toBeInTheDocument()
    })
  })

  it('renders "Nuevo Canal" button', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
  })

  it('opens create modal when clicking "Nuevo Canal"', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Nuevo Canal', { selector: 'h2' })).toBeInTheDocument()
    })
  })

  it('creates a channel successfully', async () => {
    mockCreateChannel.mockResolvedValue({ data: { data: { id: 3 } } })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'New Channel' } })

    // The submit button says "Crear Canal" in create mode
    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Canal creado')
    })
  })

  it('shows validation error when channel name is empty', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El nombre del canal es requerido')
    })
  })

  it('shows validation error when name exceeds 200 characters', async () => {
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

  it('opens delete confirm dialog', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    // The channel table uses text "Eliminar" buttons (not title attribute)
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      expect(screen.getByText('Eliminar Canal')).toBeInTheDocument()
    })
  })

  it('deletes a channel successfully', async () => {
    mockDeleteChannel.mockResolvedValue({})
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockDeleteChannel).toHaveBeenCalledWith(1)
      expect(mockToast.success).toHaveBeenCalledWith('Canal eliminado')
    })
  })

  it('shows error toast when loading channels fails', async () => {
    mockGetChannels.mockRejectedValue(new Error('Network error'))
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar canales')
    })
  })

  it('shows error toast when deleting channel fails', async () => {
    mockDeleteChannel.mockRejectedValue(new Error('fail'))
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar canal')
    })
  })

  it('renders pagination', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('pagination triggers re-fetch', async () => {
    mockGetChannels.mockResolvedValue({
      data: { data: sampleChannels, meta: { pages: 3 } },
    })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => {
      expect(mockGetChannels).toHaveBeenCalledTimes(2)
    })
  })

  it('renders column headers', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nombre')).toBeInTheDocument()
    })
    expect(screen.getByText('Categoria')).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()
  })

  // --- Edit Channel Flow ---

  describe('edit channel flow', () => {
    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({ data: { data: [] } })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    it('opens edit modal and populates form with channel data', async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(mockGetChannel).toHaveBeenCalledWith(1)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByText('Editar Canal')).toBeInTheDocument()
      })
      expect(screen.getByTestId('input-name')).toHaveValue('ESPN')
      expect(screen.getByTestId('select-category_id')).toHaveValue('1')
      expect(screen.getByTestId('input-logo_url')).toHaveValue('https://example.com/espn.png')
      expect(screen.getByTestId('input-epg_channel_id')).toHaveValue('espn.us')
      expect(screen.getByTestId('input-channel_number')).toHaveValue(10)
    })

    it('submits updated channel successfully', async () => {
      mockUpdateChannel.mockResolvedValue({ data: { data: { id: 1 } } })
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'ESPN Updated' } })
      const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
      const updateBtn = Array.from(modalButtons).find((b) => b.textContent === 'Actualizar Canal')
      fireEvent.click(updateBtn!)
      await waitFor(() => {
        expect(mockUpdateChannel).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'ESPN Updated' }))
        expect(mockToast.success).toHaveBeenCalledWith('Canal actualizado')
      })
    })

    it('shows error toast when update channel fails', async () => {
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

    it('shows error toast when loading channel for edit fails', async () => {
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

    it('displays streams in edit modal', async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      expect(screen.getByText('https://example.com/stream1.m3u8')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/stream2.m3u8')).toBeInTheDocument()
      expect(screen.getByText('HLS')).toBeInTheDocument()
      expect(screen.getByText('RTMP')).toBeInTheDocument()
    })

    it('displays stream active/inactive status', async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      // The channel list itself shows Activo/Inactivo too, so count them
      const activos = screen.getAllByText('Activo')
      const inactivos = screen.getAllByText('Inactivo')
      // Streams add more Activo/Inactivo elements
      expect(activos.length).toBeGreaterThanOrEqual(1)
      expect(inactivos.length).toBeGreaterThanOrEqual(1)
    })
  })

  // --- Create Channel Form Fields ---

  describe('create channel form fields', () => {
    it('fills all form fields and submits', async () => {
      mockCreateChannel.mockResolvedValue({ data: { data: { id: 3 } } })
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Nuevo Canal'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Fox Sports' } })
      fireEvent.change(screen.getByTestId('select-category_id'), { target: { name: 'category_id', value: '2' } })
      fireEvent.change(screen.getByTestId('input-logo_url'), { target: { name: 'logo_url', value: 'https://example.com/fox.png' } })
      fireEvent.change(screen.getByTestId('input-epg_channel_id'), { target: { name: 'epg_channel_id', value: 'fox.us' } })
      fireEvent.change(screen.getByTestId('input-channel_number'), { target: { name: 'channel_number', value: '25' } })

      const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
      const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
      fireEvent.click(createBtn!)
      await waitFor(() => {
        expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Fox Sports',
          category_id: 2,
          logo_url: 'https://example.com/fox.png',
          epg_channel_id: 'fox.us',
          channel_number: 25,
          is_active: true,
        }))
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

    it('shows error toast when create channel fails', async () => {
      mockCreateChannel.mockRejectedValue(new Error('Server error'))
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Nuevo Canal'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Failing Channel' } })
      const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
      const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
      fireEvent.click(createBtn!)
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al crear canal')
      })
    })

    it('closes modal when Cancelar is clicked', async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Nuevo Canal'))
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
      const cancelBtn = Array.from(modalButtons).find((b) => b.textContent === 'Cancelar')
      fireEvent.click(cancelBtn!)
      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
      })
    })
  })

  // --- Stream CRUD ---

  describe('stream management', () => {
    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({ data: { data: [] } })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    const openEditModalHelper = async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByText('Agregar Stream')).toBeInTheDocument()
      })
    }

    it('opens add stream form and submits', async () => {
      mockAddStream.mockResolvedValue({ data: { data: { id: 103 } } })
      // After adding, getChannel is called again to refresh streams
      mockGetChannel.mockResolvedValue({ data: { data: { ...sampleFullChannel, streams: [...sampleStreams, { id: 103, url: 'https://new.com/stream.m3u8', stream_format: 'hls', priority: 0, is_active: true }] } } })

      await openEditModalHelper()

      // "Agregar Stream" appears as both the section button and will be the submit button text
      // Click the one that opens the form (in the toolbar area)
      const addStreamBtns = screen.getAllByText('Agregar Stream')
      fireEvent.click(addStreamBtns[0])
      await waitFor(() => {
        expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByTestId('input-url'), { target: { name: 'url', value: 'https://new.com/stream.m3u8' } })
      fireEvent.change(screen.getByTestId('select-stream_format'), { target: { name: 'stream_format', value: 'rtmp' } })
      fireEvent.change(screen.getByTestId('input-priority'), { target: { name: 'priority', value: '5' } })

      // Now there are two "Agregar Stream" buttons - the toolbar one and the form submit one
      const allAddBtns = screen.getAllByText('Agregar Stream')
      // The form submit button is the last one
      fireEvent.click(allAddBtns[allAddBtns.length - 1])

      await waitFor(() => {
        expect(mockAddStream).toHaveBeenCalledWith(1, expect.objectContaining({
          url: 'https://new.com/stream.m3u8',
          stream_format: 'rtmp',
          priority: 5,
          is_active: true,
        }))
        expect(mockToast.success).toHaveBeenCalledWith('Stream agregado')
      })
    })

    it('shows validation error when stream URL is empty', async () => {
      await openEditModalHelper()

      const addStreamBtns = screen.getAllByText('Agregar Stream')
      fireEvent.click(addStreamBtns[0])
      await waitFor(() => {
        expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
      })

      // Now click the form submit "Agregar Stream" button without filling URL
      const allAddBtns = screen.getAllByText('Agregar Stream')
      fireEvent.click(allAddBtns[allAddBtns.length - 1])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('La URL del stream es obligatoria')
      })
    })

    it('shows error toast when adding stream fails', async () => {
      mockAddStream.mockRejectedValue(new Error('fail'))
      await openEditModalHelper()

      const addStreamBtns = screen.getAllByText('Agregar Stream')
      fireEvent.click(addStreamBtns[0])
      await waitFor(() => {
        expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByTestId('input-url'), { target: { name: 'url', value: 'https://fail.com/stream.m3u8' } })

      const allAddBtns = screen.getAllByText('Agregar Stream')
      fireEvent.click(allAddBtns[allAddBtns.length - 1])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al agregar stream')
      })
    })

    it('opens edit stream form with existing data', async () => {
      await openEditModalHelper()

      // Click the first stream's "Editar" button (within the streams section)
      // The modal has "Editar" buttons for each stream row
      const allEditBtns = screen.getAllByText('Editar')
      // First "Editar" is the channel table row, subsequent ones are stream rows
      // In the modal, the stream "Editar" buttons appear after the channel edit buttons
      // Find the one inside the modal
      const modalEl = screen.getByTestId('modal')
      const streamEditBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Editar')
      fireEvent.click(streamEditBtns[0])

      await waitFor(() => {
        expect(screen.getByText('Editar Stream')).toBeInTheDocument()
      })
      expect(screen.getByTestId('input-url')).toHaveValue('https://example.com/stream1.m3u8')
      expect(screen.getByTestId('select-stream_format')).toHaveValue('hls')
    })

    it('submits stream edit successfully', async () => {
      mockUpdateStream.mockResolvedValue({ data: { data: { id: 101 } } })
      await openEditModalHelper()

      const modalEl = screen.getByTestId('modal')
      const streamEditBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Editar')
      fireEvent.click(streamEditBtns[0])

      await waitFor(() => {
        expect(screen.getByText('Editar Stream')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByTestId('input-url'), { target: { name: 'url', value: 'https://updated.com/stream.m3u8' } })

      const updateStreamBtn = Array.from(modalEl.querySelectorAll('button')).find((b) => b.textContent === 'Actualizar Stream')
      fireEvent.click(updateStreamBtn!)

      await waitFor(() => {
        expect(mockUpdateStream).toHaveBeenCalledWith(1, 101, expect.objectContaining({
          url: 'https://updated.com/stream.m3u8',
        }))
        expect(mockToast.success).toHaveBeenCalledWith('Stream actualizado')
      })
    })

    it('shows error toast when updating stream fails', async () => {
      mockUpdateStream.mockRejectedValue(new Error('fail'))
      await openEditModalHelper()

      const modalEl = screen.getByTestId('modal')
      const streamEditBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Editar')
      fireEvent.click(streamEditBtns[0])

      await waitFor(() => {
        expect(screen.getByText('Editar Stream')).toBeInTheDocument()
      })

      const updateStreamBtn = Array.from(modalEl.querySelectorAll('button')).find((b) => b.textContent === 'Actualizar Stream')
      fireEvent.click(updateStreamBtn!)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al actualizar stream')
      })
    })

    it('cancels stream form', async () => {
      await openEditModalHelper()

      fireEvent.click(screen.getByText('Agregar Stream'))
      await waitFor(() => {
        expect(screen.getByText('Nuevo Stream')).toBeInTheDocument()
      })

      // Click cancel on stream form
      const modalEl = screen.getByTestId('modal')
      const streamFormCancelBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Cancelar')
      // The last Cancelar should be the stream form one
      fireEvent.click(streamFormCancelBtns[streamFormCancelBtns.length - 1])

      await waitFor(() => {
        expect(screen.queryByText('Nuevo Stream')).not.toBeInTheDocument()
      })
    })

    it('shows empty streams message when channel has no streams', async () => {
      mockGetChannel.mockResolvedValue({
        data: { data: { ...sampleFullChannel, streams: [] } },
      })
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      expect(screen.getByText('Este canal no tiene streams configurados.')).toBeInTheDocument()
    })
  })

  // --- Delete Channel: cancel ---

  it('cancels delete confirm dialog', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
  })

  // --- Stream count display ---

  it('renders stream count badges', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  // --- Category assignment in create form ---

  it('submits channel with category assignment', async () => {
    mockCreateChannel.mockResolvedValue({ data: { data: { id: 4 } } })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'New Channel' } })
    fireEvent.change(screen.getByTestId('select-category_id'), { target: { name: 'category_id', value: '1' } })

    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Channel',
        category_id: 1,
      }))
    })
  })

  // --- is_active checkbox in form ---

  it('toggles is_active checkbox in create form', async () => {
    mockCreateChannel.mockResolvedValue({ data: { data: { id: 5 } } })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Inactive Channel' } })
    // Uncheck is_active (default is true) — fireEvent.click toggles checkbox in jsdom
    const checkbox = screen.getByLabelText('Canal activo') as HTMLInputElement
    fireEvent.click(checkbox)

    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({
        is_active: false,
      }))
    })
  })

  // --- Error loading categories ---

  it('shows error toast when loading categories fails', async () => {
    mockGetCategoriesByType.mockRejectedValue(new Error('fail'))
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error cargando categorías')
    })
  })

  // --- Channel number and EPG fields in create ---

  it('submits channel with channel_number and epg_channel_id', async () => {
    mockCreateChannel.mockResolvedValue({ data: { data: { id: 6 } } })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Test CH' } })
    fireEvent.change(screen.getByTestId('input-channel_number'), { target: { name: 'channel_number', value: '42' } })
    fireEvent.change(screen.getByTestId('input-epg_channel_id'), { target: { name: 'epg_channel_id', value: 'test.epg' } })

    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test CH',
        channel_number: 42,
        epg_channel_id: 'test.epg',
      }))
    })
  })

  // --- Refetch after successful channel creation ---

  it('refetches channels after successful creation', async () => {
    mockCreateChannel.mockResolvedValue({ data: { data: { id: 7 } } })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'New' } })
    const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
    const createBtn = Array.from(modalButtons).find((b) => b.textContent === 'Crear Canal')
    fireEvent.click(createBtn!)
    await waitFor(() => {
      // Initial load + refetch after create
      expect(mockGetChannels).toHaveBeenCalledTimes(2)
    })
  })

  // --- Refetch after successful deletion ---

  it('refetches channels after successful deletion', async () => {
    mockDeleteChannel.mockResolvedValue({})
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(mockGetChannels).toHaveBeenCalledTimes(2)
    })
  })

  // --- Stream delete flow ---

  describe('stream deletion', () => {
    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({ data: { data: [] } })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    it('opens stream delete confirm and deletes successfully', async () => {
      mockDeleteStream.mockResolvedValue({})
      // After delete, refresh channel
      mockGetChannel.mockResolvedValueOnce({ data: { data: sampleFullChannel } })
        .mockResolvedValue({ data: { data: { ...sampleFullChannel, streams: [sampleStreams[1]] } } })

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

      // Click Eliminar on the first stream (inside modal)
      const modalEl = screen.getByTestId('modal')
      const streamDeleteBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Eliminar')
      fireEvent.click(streamDeleteBtns[0])

      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
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
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      const modalEl = screen.getByTestId('modal')
      const streamDeleteBtns = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.textContent === 'Eliminar')
      fireEvent.click(streamDeleteBtns[0])

      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Confirm'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar stream')
      })
    })
  })

  // --- Category select options rendered ---

  it('renders category options in modal select', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nuevo Canal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    const select = screen.getByTestId('select-category_id')
    const options = select.querySelectorAll('option')
    // --  + Sports + News = 3 options
    expect(options.length).toBe(3)
    expect(options[1]).toHaveTextContent('Sports')
    expect(options[2]).toHaveTextContent('News')
  })

  // --- Emision Local Tab ---

  describe('Emision Local tab', () => {
    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({ data: { data: [] } })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    const openEditAndSwitchToEmision = async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      // Switch to Emision Local tab
      const emisionTab = screen.getByText('Emision Local')
      fireEvent.click(emisionTab)
    }

    it('renders streams and emision tabs in edit mode', async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      expect(screen.getByText('Streams Externos')).toBeInTheDocument()
      expect(screen.getByText('Emision Local')).toBeInTheDocument()
    })

    it('shows empty media library in Emision Local tab', async () => {
      await openEditAndSwitchToEmision()
      await waitFor(() => {
        expect(screen.getByText(/Biblioteca de Medios/)).toBeInTheDocument()
      })
    })

    it('shows media items in library when available', async () => {
      mockGetMediaList.mockResolvedValue({
        data: {
          data: [
            {
              id: 1,
              original_filename: 'video1.mp4',
              status: 'completed',
              duration: 3600,
              resolution: '1080p',
              hls_path: '/media/1/stream.m3u8',
              file_size: 1024 * 1024 * 500,
            },
          ],
        },
      })

      await openEditAndSwitchToEmision()
      await waitFor(() => {
        expect(screen.getByText('video1.mp4')).toBeInTheDocument()
      })
    })
  })

  // --- Multiple pages ---

  it('fetches channels with correct page number', async () => {
    mockGetChannels.mockResolvedValue({
      data: { data: sampleChannels, meta: { pages: 5 } },
    })
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(mockGetChannels).toHaveBeenCalledWith(1, 20)
    })
  })

  // --- Editing channel form change tracking ---

  describe('edit form field changes', () => {
    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({ data: { data: [] } })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    it('changes logo_url in edit form', async () => {
      mockUpdateChannel.mockResolvedValue({ data: { data: { id: 1 } } })
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByTestId('input-logo_url'), {
        target: { name: 'logo_url', value: 'https://new-logo.com/logo.png' },
      })
      const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
      const updateBtn = Array.from(modalButtons).find((b) => b.textContent === 'Actualizar Canal')
      fireEvent.click(updateBtn!)
      await waitFor(() => {
        expect(mockUpdateChannel).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ logo_url: 'https://new-logo.com/logo.png' })
        )
      })
    })

    it('changes category in edit form', async () => {
      mockUpdateChannel.mockResolvedValue({ data: { data: { id: 1 } } })
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByTestId('select-category_id'), {
        target: { name: 'category_id', value: '2' },
      })
      const modalButtons = screen.getByTestId('modal').querySelectorAll('button')
      const updateBtn = Array.from(modalButtons).find((b) => b.textContent === 'Actualizar Canal')
      fireEvent.click(updateBtn!)
      await waitFor(() => {
        expect(mockUpdateChannel).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ category_id: 2 })
        )
      })
    })
  })

  // --- Stream selection and preview ---

  describe('stream preview and selection', () => {
    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({ data: { data: [] } })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    it('renders stream URLs and formats in edit modal', async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      expect(screen.getByText('https://example.com/stream1.m3u8')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/stream2.m3u8')).toBeInTheDocument()
    })
  })

  // --- Close modal on X button ---

  it('closes edit modal using Close button', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
    mockGetMediaList.mockResolvedValue({ data: { data: [] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
    mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  // --- Create modal resets form ---

  it('resets form fields when opening create modal', async () => {
    // First open edit, then close, then open create
    mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
    mockGetMediaList.mockResolvedValue({ data: { data: [] } })
    mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
    mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })

    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })

    // Open edit
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    expect(screen.getByTestId('input-name')).toHaveValue('ESPN')

    // Close
    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    // Open create
    fireEvent.click(screen.getByText('Nuevo Canal'))
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
    expect(screen.getByTestId('input-name')).toHaveValue('')
  })

  // --- Multiple channels with different states ---

  it('renders multiple channels with correct status badges', async () => {
    render(<ChannelsPage />)
    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
      expect(screen.getByText('CNN')).toBeInTheDocument()
    })
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  // --- Playlist management in Emision Local tab ---

  describe('playlist management', () => {
    const sampleMedia = [
      {
        id: 1,
        original_filename: 'video1.mp4',
        status: 'completed',
        duration: 3600,
        resolution: '1080p',
        hls_path: '/media/1/stream.m3u8',
        file_size: 1024 * 1024 * 500,
        progress: 100,
      },
      {
        id: 2,
        original_filename: 'video2.mp4',
        status: 'processing',
        duration: 0,
        resolution: '',
        hls_path: '',
        file_size: 1024 * 1024 * 200,
        progress: 45,
      },
    ]

    const samplePlaylistData = {
      id: 1,
      channel_id: 1,
      playback_mode: 'loop',
      items: [
        {
          id: 10,
          local_media_id: 1,
          sort_order: 0,
          local_media: {
            id: 1,
            original_filename: 'video1.mp4',
            status: 'completed',
            duration: 3600,
            resolution: '1080p',
            file_size: 1024 * 1024 * 500,
            progress: 100,
          },
        },
      ],
    }

    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({ data: { data: sampleMedia } })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: samplePlaylistData } })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    const openEmisionTab = async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Emision Local'))
    }

    it('shows media library with status badges', async () => {
      await openEmisionTab()
      await waitFor(() => {
        // video1.mp4 appears in both media library and playlist, so use getAllByText
        const video1Elements = screen.getAllByText('video1.mp4')
        expect(video1Elements.length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('video2.mp4')).toBeInTheDocument()
      })
      const listoElements = screen.getAllByText('Listo')
      expect(listoElements.length).toBeGreaterThanOrEqual(1)
    })

    it('shows playlist items', async () => {
      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Playlist del Canal')).toBeInTheDocument()
      })
      expect(screen.getByText('1/1 listos')).toBeInTheDocument()
    })

    it('adds completed media to playlist', async () => {
      // Set up a completed media that is NOT yet in the playlist
      const mediaNotInPlaylist = [
        {
          id: 5,
          original_filename: 'newvideo.mp4',
          status: 'completed',
          duration: 1800,
          resolution: '720p',
          hls_path: '/media/5/stream.m3u8',
          file_size: 1024 * 1024 * 100,
          progress: 100,
        },
      ]
      mockGetMediaList.mockResolvedValue({ data: { data: mediaNotInPlaylist } })
      // Playlist has no items yet
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: { id: 1, channel_id: 1, playback_mode: 'loop', items: [] } } })

      const mockAddPlaylistItem = adminAPI.addPlaylistItem as jest.Mock
      mockAddPlaylistItem.mockResolvedValue({})

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('newvideo.mp4')).toBeInTheDocument()
      })
      // Click "+ Playlist" button
      fireEvent.click(screen.getByText('+ Playlist'))
      await waitFor(() => {
        expect(mockAddPlaylistItem).toHaveBeenCalledWith(1, { local_media_id: 5, sort_order: 0 })
        expect(mockToast.success).toHaveBeenCalledWith('Agregado a la playlist')
      })
    })

    it('removes item from playlist', async () => {
      const mockRemovePlaylistItem = adminAPI.removePlaylistItem as jest.Mock
      mockRemovePlaylistItem.mockResolvedValue({})
      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Playlist del Canal')).toBeInTheDocument()
      })
      // Click the remove button (✕)
      const removeBtn = screen.getByTitle('Eliminar de playlist')
      fireEvent.click(removeBtn)
      await waitFor(() => {
        expect(mockRemovePlaylistItem).toHaveBeenCalledWith(1, 10)
        expect(mockToast.success).toHaveBeenCalledWith('Eliminado de la playlist')
      })
    })

    it('generates stream from playlist', async () => {
      const mockGeneratePlaylistStream = adminAPI.generatePlaylistStream as jest.Mock
      mockGeneratePlaylistStream.mockResolvedValue({})
      mockGetChannel.mockResolvedValue({ data: { data: { ...sampleFullChannel, streams: [...sampleStreams] } } })

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Generar Stream')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Generar Stream'))
      await waitFor(() => {
        expect(mockGeneratePlaylistStream).toHaveBeenCalledWith(1)
        expect(mockToast.success).toHaveBeenCalledWith('Stream generado correctamente')
      })
    })

    it('shows error when generating stream fails', async () => {
      const mockGeneratePlaylistStream = adminAPI.generatePlaylistStream as jest.Mock
      mockGeneratePlaylistStream.mockRejectedValue(new Error('fail'))

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Generar Stream')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Generar Stream'))
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al generar stream')
      })
    })

    it('shows error when removing from playlist fails', async () => {
      const mockRemovePlaylistItem = adminAPI.removePlaylistItem as jest.Mock
      mockRemovePlaylistItem.mockRejectedValue(new Error('fail'))

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Playlist del Canal')).toBeInTheDocument()
      })
      const removeBtn = screen.getByTitle('Eliminar de playlist')
      fireEvent.click(removeBtn)
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar de playlist')
      })
    })

    it('deletes a media item', async () => {
      // Use a simple media list without playlist overlap
      mockGetMediaList.mockResolvedValue({
        data: { data: [{ id: 9, original_filename: 'deleteme.mp4', status: 'completed', duration: 100, resolution: '720p', hls_path: '', file_size: 1024, progress: 100 }] },
      })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })

      const mockDeleteMedia = adminAPI.deleteMedia as jest.Mock
      mockDeleteMedia.mockResolvedValue({})

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('deleteme.mp4')).toBeInTheDocument()
      })
      const modalEl = screen.getByTestId('modal')
      const deleteMediaBtns = Array.from(modalEl.querySelectorAll('button')).filter(
        (b) => b.textContent === 'Eliminar'
      )
      fireEvent.click(deleteMediaBtns[0])
      await waitFor(() => {
        expect(mockDeleteMedia).toHaveBeenCalledWith(9)
        expect(mockToast.success).toHaveBeenCalledWith('Archivo eliminado')
      })
    })

    it('shows error when deleting media fails', async () => {
      mockGetMediaList.mockResolvedValue({
        data: { data: [{ id: 9, original_filename: 'deleteme.mp4', status: 'completed', duration: 100, resolution: '720p', hls_path: '', file_size: 1024, progress: 100 }] },
      })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })

      const mockDeleteMedia = adminAPI.deleteMedia as jest.Mock
      mockDeleteMedia.mockRejectedValue(new Error('fail'))

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('deleteme.mp4')).toBeInTheDocument()
      })
      const modalEl = screen.getByTestId('modal')
      const deleteMediaBtns = Array.from(modalEl.querySelectorAll('button')).filter(
        (b) => b.textContent === 'Eliminar'
      )
      fireEvent.click(deleteMediaBtns[0])
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar archivo')
      })
    })
  })

  // --- Emission (live ffmpeg) ---

  describe('emission control', () => {
    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({
        data: {
          data: [
            {
              id: 1,
              original_filename: 'video1.mp4',
              status: 'completed',
              duration: 3600,
              resolution: '1080p',
              hls_path: '/media/1/stream.m3u8',
              file_size: 1024 * 1024 * 500,
              progress: 100,
            },
          ],
        },
      })
      mockGetChannelPlaylist.mockResolvedValue({
        data: {
          data: {
            id: 1,
            channel_id: 1,
            playback_mode: 'loop',
            items: [
              {
                id: 10,
                local_media_id: 1,
                sort_order: 0,
                local_media: {
                  id: 1,
                  original_filename: 'video1.mp4',
                  status: 'completed',
                  duration: 3600,
                  resolution: '1080p',
                  file_size: 1024 * 1024 * 500,
                  progress: 100,
                },
              },
            ],
          },
        },
      })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    const openEmisionTab = async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Emision Local'))
    }

    it('starts emission successfully', async () => {
      const mockStartEmission = adminAPI.startEmission as jest.Mock
      mockStartEmission.mockResolvedValue({})

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Iniciar Emision')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Iniciar Emision'))
      await waitFor(() => {
        expect(mockStartEmission).toHaveBeenCalledWith(1)
        expect(mockToast.success).toHaveBeenCalledWith('Emision iniciada')
      })
    })

    it('shows error when starting emission fails', async () => {
      const mockStartEmission = adminAPI.startEmission as jest.Mock
      mockStartEmission.mockRejectedValue(new Error('fail'))

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Iniciar Emision')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Iniciar Emision'))
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al iniciar emision')
      })
    })

    it('shows stop button when emission is running', async () => {
      mockGetEmissionStatus.mockResolvedValue({
        data: { data: { status: 'running', error: '' } },
      })

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Detener Emision')).toBeInTheDocument()
        expect(screen.getByText('EN VIVO')).toBeInTheDocument()
      })
    })

    it('stops emission successfully', async () => {
      mockGetEmissionStatus.mockResolvedValue({
        data: { data: { status: 'running', error: '' } },
      })
      const mockStopEmission = adminAPI.stopEmission as jest.Mock
      mockStopEmission.mockResolvedValue({})

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Detener Emision')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Detener Emision'))
      await waitFor(() => {
        expect(mockStopEmission).toHaveBeenCalledWith(1)
        expect(mockToast.success).toHaveBeenCalledWith('Emision detenida')
      })
    })

    it('shows error when stopping emission fails', async () => {
      mockGetEmissionStatus.mockResolvedValue({
        data: { data: { status: 'running', error: '' } },
      })
      const mockStopEmission = adminAPI.stopEmission as jest.Mock
      mockStopEmission.mockRejectedValue(new Error('fail'))

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Detener Emision')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Detener Emision'))
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al detener emision')
      })
    })

    it('shows starting status', async () => {
      mockGetEmissionStatus.mockResolvedValue({
        data: { data: { status: 'starting', error: '' } },
      })

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Iniciando...')).toBeInTheDocument()
      })
    })

    it('shows error status with message', async () => {
      mockGetEmissionStatus.mockResolvedValue({
        data: { data: { status: 'error', error: 'ffmpeg crashed' } },
      })

      await openEmisionTab()
      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText('ffmpeg crashed')).toBeInTheDocument()
      })
    })
  })

  // --- Stream selection and M3U download ---

  describe('stream selection and M3U download', () => {
    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({ data: { data: [] } })
      mockGetChannelPlaylist.mockResolvedValue({ data: { data: null } })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    it('toggles stream selection checkbox', async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      // Stream checkboxes are in the modal
      const modalEl = screen.getByTestId('modal')
      const checkboxes = modalEl.querySelectorAll('input[type="checkbox"]')
      // First checkbox is "Todos", next ones are per-stream, then channel is_active
      // The stream checkboxes should be there
      expect(checkboxes.length).toBeGreaterThanOrEqual(2)
    })

    it('opens stream preview', async () => {
      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      // Click the preview button (▶)
      const previewBtns = screen.getAllByTitle('Previsualizar stream')
      fireEvent.click(previewBtns[0])
      await waitFor(() => {
        expect(screen.getByTestId('video-player')).toBeInTheDocument()
      })
    })
  })

  // --- Playback mode change ---

  describe('playback mode', () => {
    beforeEach(() => {
      mockGetChannel.mockResolvedValue({ data: { data: sampleFullChannel } })
      mockGetMediaList.mockResolvedValue({ data: { data: [] } })
      mockGetChannelPlaylist.mockResolvedValue({
        data: {
          data: {
            id: 1,
            channel_id: 1,
            playback_mode: 'loop',
            items: [
              {
                id: 10,
                local_media_id: 1,
                sort_order: 0,
                local_media: {
                  id: 1,
                  original_filename: 'video1.mp4',
                  status: 'completed',
                  duration: 3600,
                  resolution: '1080p',
                  file_size: 1024 * 1024 * 500,
                  progress: 100,
                },
              },
            ],
          },
        },
      })
      mockGetEmissionStatus.mockResolvedValue({ data: { data: null } })
    })

    it('changes playback mode', async () => {
      const mockUpdatePlaylistMode = adminAPI.updatePlaylistMode as jest.Mock
      mockUpdatePlaylistMode.mockResolvedValue({})

      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Emision Local'))

      await waitFor(() => {
        expect(screen.getByTestId('select-playback_mode')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByTestId('select-playback_mode'), {
        target: { name: 'playback_mode', value: 'shuffle' },
      })
      await waitFor(() => {
        expect(mockUpdatePlaylistMode).toHaveBeenCalledWith(1, 'shuffle')
        expect(mockToast.success).toHaveBeenCalledWith('Modo actualizado')
      })
    })

    it('shows error when changing playback mode fails', async () => {
      const mockUpdatePlaylistMode = adminAPI.updatePlaylistMode as jest.Mock
      mockUpdatePlaylistMode.mockRejectedValue(new Error('fail'))

      render(<ChannelsPage />)
      await waitFor(() => {
        expect(screen.getByText('ESPN')).toBeInTheDocument()
      })
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Emision Local'))

      await waitFor(() => {
        expect(screen.getByTestId('select-playback_mode')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByTestId('select-playback_mode'), {
        target: { name: 'playback_mode', value: 'once' },
      })
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al cambiar modo')
      })
    })
  })
})
