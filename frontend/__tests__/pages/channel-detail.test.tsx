import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import ChannelDetailPage from '@/app/(user)/channels/[id]/page'

jest.mock('@/lib/api')
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />
  },
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))
jest.mock('@/components/ui/loading-spinner', () => {
  return function MockLoadingSpinner({ text }: { text?: string }) {
    return <div data-testid="loading-spinner">{text || 'Loading...'}</div>
  }
})

const mockParams = { id: '42' }
jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
}))

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}
jest.mock('@/context/toast-context', () => ({
  useToast: () => mockToast,
}))

jest.mock('hls.js', () => {
  const MockHls: any = jest.fn(() => ({
    loadSource: jest.fn(),
    attachMedia: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
    recoverMediaError: jest.fn(),
  }))
  MockHls.isSupported = jest.fn(() => false)
  MockHls.Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
  }
  MockHls.ErrorTypes = {
    MEDIA_ERROR: 'mediaError',
    NETWORK_ERROR: 'networkError',
  }
  return { __esModule: true, default: MockHls }
})

jest.mock('@/lib/utils', () => ({
  resolveUrl: (url: string) => url,
  formatDurationHuman: (s: number) => `${Math.floor(s / 60)}m`,
  formatDurationTimer: (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
}))

import { userAPI } from '@/lib/api'

const mockGetChannel = userAPI.getChannel as jest.Mock

const sampleChannel = {
  id: 42,
  name: 'ESPN HD',
  logo_url: 'https://example.com/espn.png',
  channel_number: 5,
  category: { id: 1, name: 'Deportes' },
  streams: [
    {
      id: 1,
      url: 'https://stream.example.com/live.m3u8',
      stream_format: 'hls',
      is_active: true,
      priority: 10,
    },
  ],
}

const channelNoStreams = {
  id: 42,
  name: 'Canal Vacio',
  logo_url: null,
  channel_number: null,
  category: null,
  streams: [],
}

describe('ChannelDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    i18n.changeLanguage('es')
  })

  it('renders loading state initially', () => {
    mockGetChannel.mockImplementation(() => new Promise(() => {}))
    render(<ChannelDetailPage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByText('Cargando canal...')).toBeInTheDocument()
  })

  it('renders channel not found when API returns no data', async () => {
    mockGetChannel.mockRejectedValue(new Error('Not found'))

    render(<ChannelDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Canal no encontrado')).toBeInTheDocument()
    })

    expect(screen.getByText('Volver a canales')).toBeInTheDocument()
    expect(mockToast.error).toHaveBeenCalledWith('Error al cargar canal')
  })

  it('renders channel name and category after loading', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: sampleChannel } })

    render(<ChannelDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('ESPN HD')).toBeInTheDocument()
    })

    expect(screen.getByText('Deportes')).toBeInTheDocument()
    expect(screen.getByText('Canal 5')).toBeInTheDocument()
  })

  it('renders channel logo when logo_url exists', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: sampleChannel } })

    render(<ChannelDetailPage />)

    await waitFor(() => {
      const img = screen.getByAltText('ESPN HD')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/espn.png')
    })
  })

  it('renders back link to channels', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: sampleChannel } })

    render(<ChannelDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('ESPN HD')).toBeInTheDocument()
    })

    const backLinks = screen.getAllByText('Volver a canales')
    const link = backLinks.find((el) => el.closest('a'))
    expect(link?.closest('a')).toHaveAttribute('href', '/channels')
  })

  it('shows no streams message when channel has no active streams', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: channelNoStreams } })

    render(<ChannelDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Este canal no tiene streams disponibles')).toBeInTheDocument()
    })
  })

  it('shows EN VIVO badge for live streams', async () => {
    const liveChannel = {
      ...sampleChannel,
      streams: [
        {
          id: 1,
          url: 'https://stream.example.com/media/live/stream.m3u8',
          stream_format: 'hls',
          is_active: true,
          priority: 10,
        },
      ],
    }
    mockGetChannel.mockResolvedValue({ data: { data: liveChannel } })

    render(<ChannelDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('EN VIVO')).toBeInTheDocument()
    })
  })

  it('shows multiple active streams info', async () => {
    const multiStreamChannel = {
      ...sampleChannel,
      streams: [
        {
          id: 1,
          url: 'https://stream.example.com/live.m3u8',
          stream_format: 'hls',
          is_active: true,
          priority: 10,
        },
        {
          id: 2,
          url: 'https://stream.example.com/backup.m3u8',
          stream_format: 'hls',
          is_active: true,
          priority: 5,
        },
      ],
    }
    mockGetChannel.mockResolvedValue({ data: { data: multiStreamChannel } })

    render(<ChannelDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Streams disponibles')).toBeInTheDocument()
    })

    expect(screen.getByText('(reproduciendo)')).toBeInTheDocument()
  })

  it('renders video element when stream is available', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: sampleChannel } })

    render(<ChannelDetailPage />)

    await waitFor(() => {
      const video = document.querySelector('video')
      expect(video).toBeInTheDocument()
    })
  })

  it('does not show channel number when it is null', async () => {
    const noNumberChannel = { ...sampleChannel, channel_number: null }
    mockGetChannel.mockResolvedValue({ data: { data: noNumberChannel } })

    render(<ChannelDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('ESPN HD')).toBeInTheDocument()
    })

    expect(screen.queryByText(/Canal \d+/)).not.toBeInTheDocument()
  })
})
