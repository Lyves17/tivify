/**
 * Extended VideoPlayer tests — covers PiP toggle, textarea keyboard guard,
 * and 'p' key shortcut.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
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
  HlsMock.isSupported = jest.fn(() => true)
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

beforeAll(() => {
  window.HTMLMediaElement.prototype.pause = jest.fn()
  window.HTMLMediaElement.prototype.load = jest.fn()
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined)
})

describe('VideoPlayer - PiP toggle', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    url: '/api/streams/test.m3u8',
    format: 'hls' as const,
    title: 'Test Stream',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    hlsEventHandlers = {}
    hlsInstance = null
    window.HTMLMediaElement.prototype.pause = jest.fn()
    window.HTMLMediaElement.prototype.load = jest.fn()
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined)
  })

  it('toggles PiP on with P key when PiP is supported and not active', () => {
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: true,
      configurable: true,
    })
    Object.defineProperty(document, 'pictureInPictureElement', {
      value: null,
      configurable: true,
    })

    render(<VideoPlayer {...defaultProps} />)
    const video = document.querySelector('video') as HTMLVideoElement
    video.requestPictureInPicture = jest.fn().mockResolvedValue({})

    fireEvent.keyDown(document, { key: 'p' })
    expect(video.requestPictureInPicture).toHaveBeenCalled()
  })

  it('exits PiP with P key when already in PiP', () => {
    const video = document.createElement('video')
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: true,
      configurable: true,
    })
    Object.defineProperty(document, 'pictureInPictureElement', {
      value: video,
      configurable: true,
    })
    document.exitPictureInPicture = jest.fn().mockResolvedValue(undefined)

    render(<VideoPlayer {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'p' })
    expect(document.exitPictureInPicture).toHaveBeenCalled()

    // Clean up
    Object.defineProperty(document, 'pictureInPictureElement', {
      value: null,
      configurable: true,
    })
  })

  it('does not handle keyboard shortcuts when focus is on textarea', () => {
    render(<VideoPlayer {...defaultProps} />)
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(defaultProps.onClose).not.toHaveBeenCalled()

    document.body.removeChild(textarea)
  })

  it('PiP events update internal state without errors', () => {
    render(<VideoPlayer {...defaultProps} />)
    const video = document.querySelector('video') as HTMLVideoElement

    // Simulate PiP events — should not throw
    act(() => {
      video.dispatchEvent(new Event('enterpictureinpicture'))
    })
    act(() => {
      video.dispatchEvent(new Event('leavepictureinpicture'))
    })
    expect(video).toBeInTheDocument()
  })

  it('quality level label falls back to bitrate when height is 0', () => {
    render(<VideoPlayer {...defaultProps} />)
    hlsInstance.levels = [
      { height: 0, bitrate: 800000 },
      { height: 720, bitrate: 2500000 },
    ]
    act(() => {
      hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
        subtitleTracks: [],
      })
    })

    const qualityBtn = screen.getByRole('button', { name: /calidad/i })
    fireEvent.click(qualityBtn)
    // Quality menu items are buttons with role="menuitem"
    const menuItems = screen.getAllByRole('menuitem')
    const labels = menuItems.map((el) => el.textContent)
    expect(labels.some((l) => l?.includes('800k'))).toBe(true)
    expect(labels.some((l) => l?.includes('720p'))).toBe(true)
  })

  it('subtitle track label falls back to lang or Track N', () => {
    render(<VideoPlayer {...defaultProps} />)
    hlsInstance.levels = [
      { height: 360, bitrate: 800000 },
      { height: 720, bitrate: 2500000 },
    ]
    act(() => {
      hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
        subtitleTracks: [
          { name: '', lang: 'fr' },
          { name: '', lang: '' },
        ],
      })
    })

    const ccBtn = screen.getByText('CC')
    fireEvent.click(ccBtn)
    expect(screen.getByText('fr')).toBeInTheDocument()
    expect(screen.getByText('Track 2')).toBeInTheDocument()
  })
})
