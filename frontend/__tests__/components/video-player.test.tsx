import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VideoPlayer from '@/components/ui/video-player';
import { HLS_MAX_RETRIES } from '@/lib/constants';

// We'll capture event handlers registered via hls.on() so we can invoke them in tests.
let hlsEventHandlers: Record<string, Function>;
let hlsInstance: any;

// Mock hls.js with static methods
jest.mock('hls.js', () => {
  const HlsMock = jest.fn().mockImplementation(() => {
    hlsEventHandlers = {};
    hlsInstance = {
      loadSource: jest.fn(),
      attachMedia: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        hlsEventHandlers[event] = handler;
      }),
      destroy: jest.fn(),
      recoverMediaError: jest.fn(),
      startLoad: jest.fn(),
      levels: [],
      currentLevel: -1,
      subtitleTracks: [],
      subtitleTrack: -1,
    };
    return hlsInstance;
  });
  HlsMock.isSupported = jest.fn(() => true);
  HlsMock.Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
    LEVEL_SWITCHING: 'hlsLevelSwitching',
    SUBTITLE_TRACKS_UPDATED: 'hlsSubtitleTracksUpdated',
  };
  HlsMock.ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
  };
  return { __esModule: true, default: HlsMock };
});

// Mock HTMLMediaElement methods not implemented in jsdom
beforeAll(() => {
  window.HTMLMediaElement.prototype.pause = jest.fn();
  window.HTMLMediaElement.prototype.load = jest.fn();
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
});

describe('VideoPlayer', () => {
  const mockOnClose = jest.fn();
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    url: '/api/streams/test.m3u8',
    format: 'hls' as const,
    title: 'Test Stream',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hlsEventHandlers = {};
    hlsInstance = null;
    window.HTMLMediaElement.prototype.pause = jest.fn();
    window.HTMLMediaElement.prototype.load = jest.fn();
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  });

  it('returns null when not open', () => {
    const { container } = render(
      <VideoPlayer {...defaultProps} isOpen={false} />
    );
    // Component returns null when closed
    expect(container.innerHTML).toBe('');
  });

  it('renders player via portal when open', () => {
    render(<VideoPlayer {...defaultProps} />);
    // Portal renders into document.body
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
  });

  it('renders title', () => {
    render(<VideoPlayer {...defaultProps} />);
    expect(screen.getByText('Test Stream')).toBeInTheDocument();
  });

  it('shows error message for non-HLS formats', () => {
    render(
      <VideoPlayer
        {...defaultProps}
        format="rtmp"
        url="/api/streams/test.rtmp"
      />
    );
    expect(screen.queryAllByText(/RTMP/i).length).toBeGreaterThan(0);
  });

  it('renders video element with aria label', () => {
    render(<VideoPlayer {...defaultProps} />);
    const video = document.querySelector('video');
    expect(video).toHaveAttribute('aria-label');
  });

  // --- HLS playback initialization ---

  describe('HLS initialization', () => {
    it('creates Hls instance and loads source when format is hls', () => {
      const Hls = require('hls.js').default;
      render(<VideoPlayer {...defaultProps} />);
      expect(Hls).toHaveBeenCalled();
      expect(hlsInstance.loadSource).toHaveBeenCalledWith(
        expect.stringContaining('/api/streams/test.m3u8')
      );
      expect(hlsInstance.attachMedia).toHaveBeenCalled();
    });

    it('registers MANIFEST_PARSED, ERROR, and SUBTITLE_TRACKS_UPDATED listeners', () => {
      render(<VideoPlayer {...defaultProps} />);
      expect(hlsInstance.on).toHaveBeenCalledWith('hlsManifestParsed', expect.any(Function));
      expect(hlsInstance.on).toHaveBeenCalledWith('hlsError', expect.any(Function));
      expect(hlsInstance.on).toHaveBeenCalledWith('hlsSubtitleTracksUpdated', expect.any(Function));
    });

    it('shows loading state before manifest is parsed', () => {
      render(<VideoPlayer {...defaultProps} />);
      // The loading spinner text
      expect(screen.getByText('Cargando stream...')).toBeInTheDocument();
      // Video should have the "hidden" class while loading
      const video = document.querySelector('video');
      expect(video?.className).toContain('hidden');
    });

    it('hides loading and shows video after MANIFEST_PARSED', () => {
      render(<VideoPlayer {...defaultProps} />);

      // Fire MANIFEST_PARSED
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [],
        });
      });

      expect(screen.queryByText('Cargando stream...')).not.toBeInTheDocument();
      const video = document.querySelector('video');
      expect(video?.className).not.toContain('hidden');
    });

    it('calls video.play() after MANIFEST_PARSED', () => {
      render(<VideoPlayer {...defaultProps} />);
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [],
        });
      });
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });
  });

  // --- Channel switching (url change) ---

  describe('channel switching', () => {
    it('destroys previous hls instance and creates new one when url changes', () => {
      const { rerender } = render(<VideoPlayer {...defaultProps} />);
      const firstInstance = hlsInstance;
      const firstDestroy = firstInstance.destroy;

      rerender(
        <VideoPlayer {...defaultProps} url="/api/streams/other.m3u8" />
      );

      expect(firstDestroy).toHaveBeenCalled();
      // New instance should have been created
      expect(hlsInstance).not.toBe(firstInstance);
      expect(hlsInstance.loadSource).toHaveBeenCalledWith(
        expect.stringContaining('/api/streams/other.m3u8')
      );
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('retries on fatal network error up to HLS_MAX_RETRIES', () => {
      render(<VideoPlayer {...defaultProps} />);

      // Trigger network errors
      for (let i = 0; i < HLS_MAX_RETRIES; i++) {
        act(() => {
          hlsEventHandlers['hlsError']?.('hlsError', {
            fatal: true,
            type: 'networkError',
          });
        });
        expect(hlsInstance.startLoad).toHaveBeenCalledTimes(i + 1);
      }

      // Should NOT show error yet (retries still happening)
      // One more should exhaust retries
      act(() => {
        hlsEventHandlers['hlsError']?.('hlsError', {
          fatal: true,
          type: 'networkError',
        });
      });

      // Now error message should appear
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/varios intentos/i)).toBeInTheDocument();
    });

    it('calls recoverMediaError on fatal media error', () => {
      render(<VideoPlayer {...defaultProps} />);

      act(() => {
        hlsEventHandlers['hlsError']?.('hlsError', {
          fatal: true,
          type: 'mediaError',
        });
      });

      expect(hlsInstance.recoverMediaError).toHaveBeenCalled();
    });

    it('destroys hls and shows fatal error on unknown fatal error type', () => {
      render(<VideoPlayer {...defaultProps} />);

      act(() => {
        hlsEventHandlers['hlsError']?.('hlsError', {
          fatal: true,
          type: 'otherError',
        });
      });

      expect(hlsInstance.destroy).toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Error fatal/i)).toBeInTheDocument();
    });

    it('ignores non-fatal errors', () => {
      render(<VideoPlayer {...defaultProps} />);

      act(() => {
        hlsEventHandlers['hlsError']?.('hlsError', {
          fatal: false,
          type: 'networkError',
        });
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(hlsInstance.startLoad).not.toHaveBeenCalled();
    });

    it('shows error for MPEG-TS format', () => {
      render(
        <VideoPlayer
          {...defaultProps}
          format="mpegts"
          url="/api/streams/test.ts"
        />
      );
      expect(screen.queryAllByText(/MPEG-TS/i).length).toBeGreaterThan(0);
    });
  });

  // --- Stream URL resolution ---

  describe('stream URL resolution', () => {
    it('resolves relative URL with window.location.origin', () => {
      render(<VideoPlayer {...defaultProps} url="/api/streams/channel.m3u8" />);
      expect(hlsInstance.loadSource).toHaveBeenCalledWith(
        `${window.location.origin}/api/streams/channel.m3u8`
      );
    });

    it('passes absolute URL through unchanged', () => {
      render(
        <VideoPlayer
          {...defaultProps}
          url="https://cdn.example.com/live.m3u8"
        />
      );
      expect(hlsInstance.loadSource).toHaveBeenCalledWith(
        'https://cdn.example.com/live.m3u8'
      );
    });
  });

  // --- Quality selector ---

  describe('quality selector', () => {
    function renderWithQualities() {
      render(<VideoPlayer {...defaultProps} />);
      // Simulate manifest parsed with multiple quality levels
      hlsInstance.levels = [
        { height: 360, bitrate: 800000 },
        { height: 720, bitrate: 2500000 },
        { height: 1080, bitrate: 5000000 },
      ];
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [],
        });
      });
    }

    it('shows quality button after manifest with multiple levels', () => {
      renderWithQualities();
      const qualityBtn = screen.getByRole('button', { name: /calidad/i });
      expect(qualityBtn).toBeInTheDocument();
      expect(qualityBtn).toHaveTextContent('Auto');
    });

    it('opens quality menu on click and shows levels', () => {
      renderWithQualities();
      const qualityBtn = screen.getByRole('button', { name: /calidad/i });
      fireEvent.click(qualityBtn);

      expect(screen.getByText('360p')).toBeInTheDocument();
      expect(screen.getByText('720p')).toBeInTheDocument();
      expect(screen.getByText('1080p')).toBeInTheDocument();
    });

    it('changes quality level when a level is selected', () => {
      renderWithQualities();
      const qualityBtn = screen.getByRole('button', { name: /calidad/i });
      fireEvent.click(qualityBtn);

      fireEvent.click(screen.getByText('720p'));
      expect(hlsInstance.currentLevel).toBe(1);
    });

    it('sets quality back to auto when auto is selected', () => {
      renderWithQualities();
      const qualityBtn = screen.getByRole('button', { name: /calidad/i });
      fireEvent.click(qualityBtn);
      fireEvent.click(screen.getByText('720p'));

      // Re-open and click Auto
      fireEvent.click(qualityBtn);
      fireEvent.click(screen.getByText('Auto'));
      expect(hlsInstance.currentLevel).toBe(-1);
    });

    it('does not show quality button when only one level', () => {
      render(<VideoPlayer {...defaultProps} />);
      hlsInstance.levels = [{ height: 720, bitrate: 2500000 }];
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [],
        });
      });
      expect(screen.queryByRole('button', { name: /calidad/i })).not.toBeInTheDocument();
    });
  });

  // --- Volume controls (keyboard) ---

  describe('volume controls via keyboard', () => {
    it('increases volume with ArrowUp', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'volume', { writable: true, value: 0.5 });

      fireEvent.keyDown(document, { key: 'ArrowUp' });
      // The handler sets video.volume = Math.min(1, video.volume + 0.1)
      expect(video.volume).toBeCloseTo(0.6, 1);
    });

    it('decreases volume with ArrowDown', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'volume', { writable: true, value: 0.5 });

      fireEvent.keyDown(document, { key: 'ArrowDown' });
      expect(video.volume).toBeCloseTo(0.4, 1);
    });

    it('toggles mute with M key', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'muted', { writable: true, value: false });

      fireEvent.keyDown(document, { key: 'm' });
      expect(video.muted).toBe(true);

      fireEvent.keyDown(document, { key: 'm' });
      expect(video.muted).toBe(false);
    });

    it('clamps volume to max 1', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'volume', { writable: true, value: 0.95 });

      fireEvent.keyDown(document, { key: 'ArrowUp' });
      expect(video.volume).toBe(1);
    });

    it('clamps volume to min 0', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'volume', { writable: true, value: 0.05 });

      fireEvent.keyDown(document, { key: 'ArrowDown' });
      expect(video.volume).toBe(0);
    });
  });

  // --- Fullscreen toggle (keyboard) ---

  describe('fullscreen toggle', () => {
    it('requests fullscreen with F key when not in fullscreen', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      video.requestFullscreen = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
      });

      fireEvent.keyDown(document, { key: 'f' });
      expect(video.requestFullscreen).toHaveBeenCalled();
    });

    it('exits fullscreen with F key when in fullscreen', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(document, 'fullscreenElement', {
        value: video,
        configurable: true,
      });
      document.exitFullscreen = jest.fn().mockResolvedValue(undefined);

      fireEvent.keyDown(document, { key: 'f' });
      expect(document.exitFullscreen).toHaveBeenCalled();

      // Clean up
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
      });
    });
  });

  // --- Loading states ---

  describe('loading states', () => {
    it('shows loading spinner when isOpen and no error', () => {
      render(<VideoPlayer {...defaultProps} />);
      expect(screen.getByText('Cargando stream...')).toBeInTheDocument();
    });

    it('hides loading spinner when error occurs', () => {
      render(<VideoPlayer {...defaultProps} />);
      act(() => {
        hlsEventHandlers['hlsError']?.('hlsError', {
          fatal: true,
          type: 'otherError',
        });
      });
      expect(screen.queryByText('Cargando stream...')).not.toBeInTheDocument();
    });

    it('hides video element while loading', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video');
      expect(video?.className).toContain('hidden');
    });

    it('shows video element after loading completes', () => {
      render(<VideoPlayer {...defaultProps} />);
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [],
        });
      });
      const video = document.querySelector('video');
      expect(video?.className).not.toContain('hidden');
    });

    it('non-HLS format sets loading to false immediately', () => {
      render(
        <VideoPlayer {...defaultProps} format="rtmp" url="/api/streams/test.rtmp" />
      );
      // No loading spinner for unsupported formats
      expect(screen.queryByText('Cargando stream...')).not.toBeInTheDocument();
    });
  });

  // --- Retry logic ---

  describe('retry logic on network error', () => {
    it('calls startLoad for each retry', () => {
      render(<VideoPlayer {...defaultProps} />);

      act(() => {
        hlsEventHandlers['hlsError']?.('hlsError', {
          fatal: true,
          type: 'networkError',
        });
      });
      expect(hlsInstance.startLoad).toHaveBeenCalledTimes(1);

      act(() => {
        hlsEventHandlers['hlsError']?.('hlsError', {
          fatal: true,
          type: 'networkError',
        });
      });
      expect(hlsInstance.startLoad).toHaveBeenCalledTimes(2);
    });

    it('shows network error message after max retries exhausted', () => {
      render(<VideoPlayer {...defaultProps} />);

      // Exhaust all retries
      for (let i = 0; i <= HLS_MAX_RETRIES; i++) {
        act(() => {
          hlsEventHandlers['hlsError']?.('hlsError', {
            fatal: true,
            type: 'networkError',
          });
        });
      }

      expect(hlsInstance.startLoad).toHaveBeenCalledTimes(HLS_MAX_RETRIES);
      expect(screen.getByText(/varios intentos/i)).toBeInTheDocument();
    });
  });

  // --- Direct play for non-HLS when Hls is not supported ---

  describe('native HLS fallback (Safari)', () => {
    it('sets video.src directly when Hls.isSupported() is false but canPlayType works', () => {
      const Hls = require('hls.js').default;
      Hls.isSupported.mockReturnValueOnce(false);

      // Mock canPlayType to return truthy for Safari HLS
      const origCanPlayType = window.HTMLMediaElement.prototype.canPlayType;
      window.HTMLMediaElement.prototype.canPlayType = jest.fn((type: string) => {
        if (type === 'application/vnd.apple.mpegurl') return 'maybe';
        return '';
      });

      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      expect(video.src).toContain('/api/streams/test.m3u8');

      // Restore
      window.HTMLMediaElement.prototype.canPlayType = origCanPlayType;
    });

    it('shows unsupported error when Hls not supported and no native HLS', () => {
      const Hls = require('hls.js').default;
      Hls.isSupported.mockReturnValueOnce(false);

      const origCanPlayType = window.HTMLMediaElement.prototype.canPlayType;
      window.HTMLMediaElement.prototype.canPlayType = jest.fn(() => '');

      render(<VideoPlayer {...defaultProps} />);
      expect(screen.getByText(/no soporta/i)).toBeInTheDocument();

      window.HTMLMediaElement.prototype.canPlayType = origCanPlayType;
    });
  });

  // --- Keyboard shortcuts ---

  describe('keyboard shortcuts', () => {
    it('closes player on Escape key', () => {
      render(<VideoPlayer {...defaultProps} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('toggles play/pause with Space key', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'paused', { value: true, configurable: true });

      fireEvent.keyDown(document, { key: ' ' });
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });

    it('toggles play/pause with K key', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'paused', { value: false, configurable: true });

      fireEvent.keyDown(document, { key: 'k' });
      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    });

    it('seeks backward with ArrowLeft', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'currentTime', { writable: true, value: 30 });

      fireEvent.keyDown(document, { key: 'ArrowLeft' });
      expect(video.currentTime).toBe(20);
    });

    it('seeks forward with ArrowRight', () => {
      render(<VideoPlayer {...defaultProps} />);
      const video = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'currentTime', { writable: true, value: 30 });
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });

      fireEvent.keyDown(document, { key: 'ArrowRight' });
      expect(video.currentTime).toBe(40);
    });

    it('does not handle keys when target is an input', () => {
      render(<VideoPlayer {...defaultProps} />);
      const input = document.createElement('input');
      document.body.appendChild(input);

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(mockOnClose).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  // --- Close and cleanup ---

  describe('close and cleanup', () => {
    it('destroys hls instance on close', () => {
      render(<VideoPlayer {...defaultProps} />);
      const destroyFn = hlsInstance.destroy;

      // Click backdrop to close
      const backdrop = document.querySelector('.bg-black\\/80');
      fireEvent.click(backdrop!);

      expect(destroyFn).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      render(<VideoPlayer {...defaultProps} />);
      // The close button has aria-label from t("common.close")
      const closeBtn = screen.getByRole('button', { name: /cerrar/i });
      fireEvent.click(closeBtn);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // --- Speed selector ---

  describe('speed selector', () => {
    function renderWithToolbar() {
      // Ensure pipSupported is true so the toolbar renders
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        value: true,
        configurable: true,
      });
      render(<VideoPlayer {...defaultProps} />);
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [],
        });
      });
    }

    it('shows speed button with default 1x', () => {
      renderWithToolbar();
      const speedBtn = screen.getByRole('button', { name: /velocidad/i });
      expect(speedBtn).toHaveTextContent('1x');
    });

    it('opens speed menu and changes playback rate', () => {
      renderWithToolbar();
      const speedBtn = screen.getByRole('button', { name: /velocidad/i });
      fireEvent.click(speedBtn);

      // Select 2x speed
      fireEvent.click(screen.getByText('2x'));
      const video = document.querySelector('video') as HTMLVideoElement;
      expect(video.playbackRate).toBe(2);
    });
  });

  // --- Subtitle tracks ---

  describe('subtitle tracks', () => {
    it('shows subtitle button when tracks are available via MANIFEST_PARSED', () => {
      render(<VideoPlayer {...defaultProps} />);
      hlsInstance.levels = [
        { height: 360, bitrate: 800000 },
        { height: 720, bitrate: 2500000 },
      ];
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [
            { name: 'English', lang: 'en' },
            { name: 'Spanish', lang: 'es' },
          ],
        });
      });

      const ccBtn = screen.getByText('CC');
      expect(ccBtn).toBeInTheDocument();
    });

    it('updates subtitles on SUBTITLE_TRACKS_UPDATED event', () => {
      render(<VideoPlayer {...defaultProps} />);
      hlsInstance.levels = [
        { height: 360, bitrate: 800000 },
        { height: 720, bitrate: 2500000 },
      ];
      // First, parse manifest with no subtitles
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [],
        });
      });

      // Then subtitle tracks updated
      act(() => {
        hlsEventHandlers['hlsSubtitleTracksUpdated']?.('hlsSubtitleTracksUpdated', {
          subtitleTracks: [
            { name: 'French', lang: 'fr' },
          ],
        });
      });

      const ccBtn = screen.getByText('CC');
      fireEvent.click(ccBtn);
      expect(screen.getByText('French')).toBeInTheDocument();
    });

    it('changes subtitle track when selected', () => {
      render(<VideoPlayer {...defaultProps} />);
      hlsInstance.levels = [
        { height: 360, bitrate: 800000 },
        { height: 720, bitrate: 2500000 },
      ];
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [
            { name: 'English', lang: 'en' },
          ],
        });
      });

      const ccBtn = screen.getByText('CC');
      fireEvent.click(ccBtn);
      fireEvent.click(screen.getByText('English'));
      expect(hlsInstance.subtitleTrack).toBe(0);
    });

    it('turns off subtitles when Off is selected', () => {
      render(<VideoPlayer {...defaultProps} />);
      hlsInstance.levels = [
        { height: 360, bitrate: 800000 },
        { height: 720, bitrate: 2500000 },
      ];
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [
            { name: 'English', lang: 'en' },
          ],
        });
      });

      const ccBtn = screen.getByText('CC');
      fireEvent.click(ccBtn);
      fireEvent.click(screen.getByText('English'));

      // Re-open and click Desactivado (Off)
      fireEvent.click(ccBtn);
      fireEvent.click(screen.getByText('Desactivado'));
      expect(hlsInstance.subtitleTrack).toBe(-1);
    });
  });

  // --- Copy URL ---

  describe('copy URL', () => {
    it('copies resolved URL to clipboard', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
      });

      render(<VideoPlayer {...defaultProps} />);
      const copyBtn = screen.getByRole('button', { name: /copiar url/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/api/streams/test.m3u8')
      );
    });

    it('falls back to execCommand when clipboard API fails', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
      });
      document.execCommand = jest.fn();

      render(<VideoPlayer {...defaultProps} />);
      const copyBtn = screen.getByRole('button', { name: /copiar url/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });
  });

  // --- Dialog backdrop close and menu dismissal ---

  describe('dialog interactions', () => {
    it('closes all menus when clicking on the dialog overlay', () => {
      render(<VideoPlayer {...defaultProps} />);
      hlsInstance.levels = [
        { height: 360, bitrate: 800000 },
        { height: 720, bitrate: 2500000 },
      ];
      act(() => {
        hlsEventHandlers['hlsManifestParsed']?.('hlsManifestParsed', {
          subtitleTracks: [],
        });
      });

      // Open quality menu
      const qualityBtn = screen.getByRole('button', { name: /calidad/i });
      fireEvent.click(qualityBtn);
      expect(screen.getByText('360p')).toBeInTheDocument();

      // Click on the dialog overlay (the outermost div)
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      // Menu should close
      expect(screen.queryByText('360p')).not.toBeInTheDocument();
    });

    it('renders with default title when none provided', () => {
      render(
        <VideoPlayer
          isOpen={true}
          onClose={mockOnClose}
          url="/api/streams/test.m3u8"
          format="hls"
        />
      );
      expect(screen.getByText('Stream Preview')).toBeInTheDocument();
    });
  });

  // --- Cleanup on unmount ---

  describe('unmount cleanup', () => {
    it('destroys hls instance when component unmounts', () => {
      const { unmount } = render(<VideoPlayer {...defaultProps} />);
      const destroyFn = hlsInstance.destroy;

      unmount();
      expect(destroyFn).toHaveBeenCalled();
    });
  });
});
