/**
 * Additional coverage tests for VideoPlayer — Safari native HLS path.
 * Covers uncovered lines:
 *   - Lines 258-259: loadedmetadata handler (setLoading(false), video.play().catch)
 *   - Lines 262-263: error handler (setLoading(false), setError)
 */
import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import VideoPlayer from '@/components/ui/video-player'

let hlsEventHandlers: Record<string, Function>
let hlsInstance: any

jest.mock('hls.js', () => {
  const HlsMock = jest.fn().mockImplementation(() => {
    hlsEventHandlers = {}
    hlsInstance = {
      loadSource: jest.fn(),
      attachMedia: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        hlsEventHandlers[event] = handler
      }),
      destroy: jest.fn(),
      recoverMediaError: jest.fn(),
      startLoad: jest.fn(),
      levels: [],
      currentLevel: -1,
      subtitleTracks: [],
      subtitleTrack: -1,
    }
    return hlsInstance
  })
  // Default: NOT supported (to trigger Safari native HLS path)
  HlsMock.isSupported = jest.fn(() => false)
  HlsMock.Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
    LEVEL_SWITCHING: 'hlsLevelSwitching',
    SUBTITLE_TRACKS_UPDATED: 'hlsSubtitleTracksUpdated',
  }
  HlsMock.ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
  }
  return { __esModule: true, default: HlsMock }
})

describe('VideoPlayer - Safari native HLS event handlers', () => {
  const mockOnClose = jest.fn()
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    url: '/api/streams/test.m3u8',
    format: 'hls' as const,
    title: 'Safari Test',
  }

  let origCanPlayType: typeof HTMLMediaElement.prototype.canPlayType

  beforeAll(() => {
    origCanPlayType = window.HTMLMediaElement.prototype.canPlayType
    window.HTMLMediaElement.prototype.pause = jest.fn()
    window.HTMLMediaElement.prototype.load = jest.fn()
  })

  afterAll(() => {
    window.HTMLMediaElement.prototype.canPlayType = origCanPlayType
  })

  beforeEach(() => {
    jest.clearAllMocks()
    hlsEventHandlers = {}
    hlsInstance = null

    // Safari native HLS: canPlayType returns 'maybe' for HLS
    window.HTMLMediaElement.prototype.canPlayType = jest.fn((type: string) => {
      if (type === 'application/vnd.apple.mpegurl') return 'maybe'
      return ''
    }) as any
  })

  it('fires loadedmetadata and calls play successfully (lines 258-259)', async () => {
    const mockPlay = jest.fn().mockResolvedValue(undefined)
    window.HTMLMediaElement.prototype.play = mockPlay

    render(<VideoPlayer {...defaultProps} />)

    const video = document.querySelector('video') as HTMLVideoElement
    expect(video).toBeInTheDocument()
    expect(video.src).toContain('/api/streams/test.m3u8')

    // Initially shows loading
    expect(screen.getByText('Cargando stream...')).toBeInTheDocument()

    // Dispatch loadedmetadata
    await act(async () => {
      video.dispatchEvent(new Event('loadedmetadata'))
    })

    // Loading should be gone
    expect(screen.queryByText('Cargando stream...')).not.toBeInTheDocument()
    expect(mockPlay).toHaveBeenCalled()
  })

  it('fires loadedmetadata and handles play() rejection (line 259 catch)', async () => {
    const mockPlay = jest.fn().mockRejectedValue(new Error('Autoplay blocked'))
    window.HTMLMediaElement.prototype.play = mockPlay

    render(<VideoPlayer {...defaultProps} />)

    const video = document.querySelector('video') as HTMLVideoElement

    await act(async () => {
      video.dispatchEvent(new Event('loadedmetadata'))
    })

    // Should still hide loading even on play rejection
    expect(screen.queryByText('Cargando stream...')).not.toBeInTheDocument()
    expect(mockPlay).toHaveBeenCalled()
  })

  it('fires error event and shows fatal error (lines 262-263)', async () => {
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined)

    render(<VideoPlayer {...defaultProps} />)

    const video = document.querySelector('video') as HTMLVideoElement

    // Dispatch error event
    await act(async () => {
      video.dispatchEvent(new Event('error'))
    })

    // Should show error message and hide loading
    expect(screen.queryByText('Cargando stream...')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
