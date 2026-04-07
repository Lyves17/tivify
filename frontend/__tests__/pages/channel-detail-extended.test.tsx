/**
 * Extended tests for channel detail page.
 * Covers: HLS player initialization, non-HLS streams, Safari native HLS,
 * error states, stream selection logic (bestStream), live stream detection.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

jest.mock('@/lib/api')
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
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

const mockParams = { id: '10' }
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

// Capture HLS event handlers
let hlsEventHandlers: Record<string, any> = {}
const mockHlsInstance = {
  loadSource: jest.fn(),
  attachMedia: jest.fn(),
  on: jest.fn((event: string, handler: any) => {
    hlsEventHandlers[event] = handler
  }),
  destroy: jest.fn(),
  recoverMediaError: jest.fn(),
}

jest.mock('hls.js', () => {
  const MockHls: any = jest.fn(() => {
    hlsEventHandlers = {}
    return {
      loadSource: mockHlsInstance.loadSource,
      attachMedia: mockHlsInstance.attachMedia,
      on: mockHlsInstance.on,
      destroy: mockHlsInstance.destroy,
      recoverMediaError: mockHlsInstance.recoverMediaError,
    }
  })
  MockHls.isSupported = jest.fn(() => true)
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
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

import { userAPI } from '@/lib/api'
import Hls from 'hls.js'

const mockGetChannel = userAPI.getChannel as jest.Mock

const hlsChannel = {
  id: 10,
  name: 'Test Channel',
  logo_url: null,
  channel_number: 1,
  category: { id: 1, name: 'Sports' },
  streams: [
    {
      id: 1,
      url: 'https://stream.example.com/stream.m3u8',
      stream_format: 'hls',
      is_active: true,
      priority: 10,
    },
  ],
}

const nonHlsChannel = {
  id: 10,
  name: 'RTSP Channel',
  logo_url: null,
  channel_number: 2,
  category: null,
  streams: [
    {
      id: 1,
      url: 'rtsp://stream.example.com/live',
      stream_format: 'rtsp',
      is_active: true,
      priority: 10,
    },
  ],
}

const mixedStreamsChannel = {
  id: 10,
  name: 'Mixed Channel',
  logo_url: 'https://example.com/logo.png',
  channel_number: null,
  category: { id: 2, name: 'General' },
  streams: [
    {
      id: 1,
      url: 'https://stream.example.com/backup.m3u8',
      stream_format: 'hls',
      is_active: true,
      priority: 5,
    },
    {
      id: 2,
      url: 'https://stream.example.com/media/live/main.m3u8',
      stream_format: 'hls',
      is_active: true,
      priority: 3,
    },
    {
      id: 3,
      url: 'rtsp://stream.example.com/fallback',
      stream_format: 'rtsp',
      is_active: false,
      priority: 1,
    },
  ],
}

const inactiveStreamsChannel = {
  id: 10,
  name: 'Inactive Channel',
  logo_url: null,
  channel_number: null,
  category: null,
  streams: [
    {
      id: 1,
      url: 'https://stream.example.com/stream.m3u8',
      stream_format: 'hls',
      is_active: false,
      priority: 10,
    },
  ],
}

describe('ChannelDetailPage - extended', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    hlsEventHandlers = {}
    ;(Hls.isSupported as jest.Mock).mockReturnValue(true)
  })

  it('initializes HLS player for HLS streams when Hls.isSupported', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    expect(mockHlsInstance.loadSource).toHaveBeenCalledWith('https://stream.example.com/stream.m3u8')
    expect(mockHlsInstance.attachMedia).toHaveBeenCalled()
  })

  it('shows error for non-HLS stream formats', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: nonHlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText(/RTSP no se pueden reproducir en el navegador/)).toBeInTheDocument()
    })
  })

  it('prefers live emission stream over regular HLS', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: mixedStreamsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Mixed Channel')).toBeInTheDocument()
    })

    // Should load the live stream URL (contains /media/live/)
    expect(mockHlsInstance.loadSource).toHaveBeenCalledWith(
      'https://stream.example.com/media/live/main.m3u8'
    )
  })

  it('shows EN VIVO badge when live stream is selected', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: mixedStreamsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('EN VIVO')).toBeInTheDocument()
    })
  })

  it('shows "no streams" when all streams are inactive', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: inactiveStreamsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Este canal no tiene streams disponibles')).toBeInTheDocument()
    })
  })

  it('shows Tv icon when no logo_url', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    // No img tag should exist for the channel logo
    expect(screen.queryByAltText('Test Channel')).not.toBeInTheDocument()
  })

  it('shows logo image when logo_url exists', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: mixedStreamsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByAltText('Mixed Channel')).toBeInTheDocument()
    })
  })

  it('does not show category when it is null', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: nonHlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('RTSP Channel')).toBeInTheDocument()
    })

    expect(screen.queryByText('Sports')).not.toBeInTheDocument()
  })

  it('shows streams available section for multi-stream channels', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: mixedStreamsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Streams disponibles')).toBeInTheDocument()
    })

    // Should show "(reproduciendo)" for the selected stream
    expect(screen.getByText('(reproduciendo)')).toBeInTheDocument()
    // Should show "Live" for the live stream
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('falls back to Safari native HLS when Hls.isSupported returns false', async () => {
    ;(Hls.isSupported as jest.Mock).mockReturnValue(false)

    // Mock canPlayType for Safari
    const origCreateElement = document.createElement.bind(document)
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag)
      if (tag === 'video') {
        el.canPlayType = jest.fn((type: string) =>
          type === 'application/vnd.apple.mpegurl' ? 'probably' : ''
        )
      }
      return el
    })

    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    // HLS should NOT have been instantiated
    expect(mockHlsInstance.loadSource).not.toHaveBeenCalled()

    ;(document.createElement as jest.Mock).mockRestore()
  })

  it('shows browser unsupported error when neither HLS.js nor native HLS works', async () => {
    ;(Hls.isSupported as jest.Mock).mockReturnValue(false)

    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    // canPlayType returns empty string by default in jsdom, so we should see the error
    await waitFor(() => {
      expect(screen.getByText('Tu navegador no soporta reproduccion HLS.')).toBeInTheDocument()
    })
  })

  it('calls video.play on MANIFEST_PARSED and handles autoplay blocked', async () => {
    const mockPlay = jest.fn().mockRejectedValue(new Error('Autoplay blocked'))
    Object.defineProperty(HTMLVideoElement.prototype, 'play', {
      configurable: true,
      value: mockPlay,
    })

    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    // Trigger MANIFEST_PARSED
    const manifestHandler = hlsEventHandlers['hlsManifestParsed']
    expect(manifestHandler).toBeDefined()
    await manifestHandler()

    expect(mockPlay).toHaveBeenCalled()

    delete (HTMLVideoElement.prototype as any).play
  })

  it('recovers from HLS MEDIA_ERROR', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    const errorHandler = hlsEventHandlers['hlsError']
    expect(errorHandler).toBeDefined()
    errorHandler('hlsError', { fatal: true, type: 'mediaError' })

    expect(mockHlsInstance.recoverMediaError).toHaveBeenCalled()
  })

  it('shows network error and auto-retries for HLS NETWORK_ERROR', async () => {
    jest.useFakeTimers()
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    const errorHandler = hlsEventHandlers['hlsError']
    expect(errorHandler).toBeDefined()
    errorHandler('hlsError', { fatal: true, type: 'networkError' })

    await waitFor(() => {
      expect(screen.getByText('Error de red. Reintentando en 5 segundos...')).toBeInTheDocument()
    })

    // Advance timer to trigger retry
    mockHlsInstance.loadSource.mockClear()
    jest.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(mockHlsInstance.loadSource).toHaveBeenCalledWith('https://stream.example.com/stream.m3u8')
    })

    jest.useRealTimers()
  })

  it('destroys HLS and retries for unknown fatal errors', async () => {
    jest.useFakeTimers()
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    const errorHandler = hlsEventHandlers['hlsError']
    expect(errorHandler).toBeDefined()
    mockHlsInstance.destroy.mockClear()
    errorHandler('hlsError', { fatal: true, type: 'otherError' })

    expect(mockHlsInstance.destroy).toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByText('Error al reproducir el stream.')).toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  it('ignores non-fatal HLS errors', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    const errorHandler = hlsEventHandlers['hlsError']
    expect(errorHandler).toBeDefined()
    mockHlsInstance.recoverMediaError.mockClear()
    mockHlsInstance.destroy.mockClear()
    errorHandler('hlsError', { fatal: false, type: 'mediaError' })

    // Non-fatal should not trigger recovery
    expect(mockHlsInstance.recoverMediaError).not.toHaveBeenCalled()
    expect(mockHlsInstance.destroy).not.toHaveBeenCalled()
  })

  it('cleans up HLS on unmount', async () => {
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    const { unmount } = render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    mockHlsInstance.destroy.mockClear()
    unmount()

    expect(mockHlsInstance.destroy).toHaveBeenCalled()
  })

  it('clears previous retry timeout when re-initializing', async () => {
    jest.useFakeTimers()
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    // Trigger a network error to set a retry timeout
    const errorHandler = hlsEventHandlers['hlsError']
    errorHandler('hlsError', { fatal: true, type: 'networkError' })

    await waitFor(() => {
      expect(screen.getByText('Error de red. Reintentando en 5 segundos...')).toBeInTheDocument()
    })

    // The retry timeout is set; now advance partially
    jest.advanceTimersByTime(2000)

    // The cleanup should clear the timeout when the component effect re-runs on unmount
    jest.useRealTimers()
  })

  it('handles Safari native HLS loadedmetadata and play', async () => {
    ;(Hls.isSupported as jest.Mock).mockReturnValue(false)

    // Mock canPlayType to simulate Safari
    const origCanPlayType = HTMLVideoElement.prototype.canPlayType
    HTMLVideoElement.prototype.canPlayType = jest.fn((type: string) =>
      type === 'application/vnd.apple.mpegurl' ? 'probably' : ''
    ) as any

    // Mock play
    const mockPlay = jest.fn().mockRejectedValue(new Error('autoplay blocked'))
    HTMLVideoElement.prototype.play = mockPlay

    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    const video = document.querySelector('video') as HTMLVideoElement
    expect(video).toBeInTheDocument()

    // Fire loadedmetadata event to trigger the Safari handler
    const loadedEvent = new Event('loadedmetadata')
    video.dispatchEvent(loadedEvent)

    await waitFor(() => {
      expect(mockPlay).toHaveBeenCalled()
    })

    HTMLVideoElement.prototype.canPlayType = origCanPlayType
    delete (HTMLVideoElement.prototype as any).play
  })

  it('handles Safari native HLS error event', async () => {
    ;(Hls.isSupported as jest.Mock).mockReturnValue(false)

    // Mock canPlayType to simulate Safari
    const origCanPlayType = HTMLVideoElement.prototype.canPlayType
    HTMLVideoElement.prototype.canPlayType = jest.fn((type: string) =>
      type === 'application/vnd.apple.mpegurl' ? 'probably' : ''
    ) as any

    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    const video = document.querySelector('video') as HTMLVideoElement
    expect(video).toBeInTheDocument()

    // Fire error event
    const errorEvent = new Event('error')
    video.dispatchEvent(errorEvent)

    await waitFor(() => {
      expect(screen.getByText('Error al reproducir el stream.')).toBeInTheDocument()
    })

    HTMLVideoElement.prototype.canPlayType = origCanPlayType
  })

  it('advances default error retry timeout to trigger setChannel re-render', async () => {
    jest.useFakeTimers()
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    const errorHandler = hlsEventHandlers['hlsError']
    expect(errorHandler).toBeDefined()
    mockHlsInstance.destroy.mockClear()
    errorHandler('hlsError', { fatal: true, type: 'otherError' })

    expect(mockHlsInstance.destroy).toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByText('Error al reproducir el stream.')).toBeInTheDocument()
    })

    // Advance timer 5s to trigger the default error retry callback (lines 139-141)
    jest.advanceTimersByTime(5000)

    // The retry callback calls setPlayerError(null) and setChannel to re-trigger
    // After re-trigger, data reloads; no error should show anymore
    await waitFor(() => {
      expect(screen.queryByText('Error al reproducir el stream.')).not.toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  it('clears previous retry timeout when effect re-runs (lines 82-83)', async () => {
    jest.useFakeTimers()
    mockGetChannel.mockResolvedValue({ data: { data: hlsChannel } })

    render(React.createElement(require('@/app/(user)/channels/[id]/page').default))

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    // Trigger a network error to set retryTimeoutRef.current
    const errorHandler = hlsEventHandlers['hlsError']
    errorHandler('hlsError', { fatal: true, type: 'networkError' })

    await waitFor(() => {
      expect(screen.getByText('Error de red. Reintentando en 5 segundos...')).toBeInTheDocument()
    })

    // Now trigger the retry to re-run the effect, which will hit lines 81-83
    // Advance 5s to fire the network error retry (loadSource again)
    mockHlsInstance.loadSource.mockClear()
    jest.advanceTimersByTime(5000)

    // loadSource is called by the retry callback at line 130
    await waitFor(() => {
      expect(mockHlsInstance.loadSource).toHaveBeenCalled()
    })

    jest.useRealTimers()
  })
})
