/**
 * Additional extended tests for VODDetailPage (src/app/(user)/vod/[id]/page.tsx)
 * Covers: edge cases in rendering, metadata display conditions, player states
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import VODDetailPage from '@/app/(user)/vod/[id]/page'

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

const mockGetVOD = userAPI.getVOD as jest.Mock
const mockGetContinueWatching = userAPI.getContinueWatching as jest.Mock
const mockRecordHistory = userAPI.recordHistory as jest.Mock

const sampleVod = {
  id: 10,
  title: 'Inception',
  poster_url: 'https://example.com/poster.jpg',
  backdrop_url: 'https://example.com/backdrop.jpg',
  description: 'A mind-bending thriller about dreams within dreams.',
  year: 2010,
  rating: 8.8,
  duration: 8880,
  resolution: '1080p',
  category: { id: 1, name: 'Sci-Fi' },
  hls_path: null,
  transcode_status: '',
  transcode_progress: 0,
  series_id: null,
  season_number: 0,
  episode_number: 0,
}

describe('VODDetailPage - additional edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    i18n.changeLanguage('es')
    mockGetContinueWatching.mockResolvedValue({ data: { data: [] } })
    if (mockRecordHistory) mockRecordHistory.mockResolvedValue({})
  })

  it('renders VOD with all metadata (year, rating, duration, resolution, category)', async () => {
    mockGetVOD.mockResolvedValue({ data: { data: sampleVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    expect(screen.getByText('2010')).toBeInTheDocument()
    expect(screen.getByText('8.8')).toBeInTheDocument()
    expect(screen.getByText('148m')).toBeInTheDocument() // 8880/60 = 148
    expect(screen.getByText('1080p')).toBeInTheDocument()
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
  })

  it('does not render any metadata badges when all are zero/empty/null', async () => {
    const noMetaVod = {
      ...sampleVod,
      year: 0,
      rating: 0,
      duration: 0,
      resolution: '',
      category: null,
      description: '',
      backdrop_url: '',
      poster_url: '',
    }
    mockGetVOD.mockResolvedValue({ data: { data: noMetaVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    expect(screen.queryByText('2010')).not.toBeInTheDocument()
    expect(screen.queryByText('Sci-Fi')).not.toBeInTheDocument()
  })

  it('renders both backdrop and title in same view for non-player VOD', async () => {
    mockGetVOD.mockResolvedValue({ data: { data: sampleVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    // Backdrop should show
    const img = screen.getByAltText('Inception')
    expect(img).toHaveAttribute('src', 'https://example.com/backdrop.jpg')
    // Description should show
    expect(screen.getByText('A mind-bending thriller about dreams within dreams.')).toBeInTheDocument()
  })

  it('shows poster when backdrop_url is empty but poster_url exists', async () => {
    const posterOnlyVod = {
      ...sampleVod,
      backdrop_url: '',
      poster_url: 'https://example.com/poster.jpg',
    }
    mockGetVOD.mockResolvedValue({ data: { data: posterOnlyVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    const img = screen.getByAltText('Inception')
    expect(img).toHaveAttribute('src', 'https://example.com/poster.jpg')
  })

  it('does not show poster when both backdrop_url and poster_url are empty', async () => {
    const noImageVod = {
      ...sampleVod,
      backdrop_url: '',
      poster_url: '',
    }
    mockGetVOD.mockResolvedValue({ data: { data: noImageVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    expect(screen.queryByAltText('Inception')).not.toBeInTheDocument()
  })

  it('renders episode back link when series_id is truthy', async () => {
    const episode = {
      ...sampleVod,
      series_id: 5,
      season_number: 2,
      episode_number: 3,
    }
    mockGetVOD.mockResolvedValue({ data: { data: episode } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Volver a la serie')).toBeInTheDocument()
    })
    const link = screen.getByText('Volver a la serie').closest('a')
    expect(link).toHaveAttribute('href', '/series/5')
    expect(screen.getByText(/Temporada 2/)).toBeInTheDocument()
    expect(screen.getByText(/Episodio 3/)).toBeInTheDocument()
  })

  it('renders rating with one decimal place', async () => {
    const ratingVod = { ...sampleVod, rating: 7.12345 }
    mockGetVOD.mockResolvedValue({ data: { data: ratingVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('7.1')).toBeInTheDocument()
    })
  })

  it('renders transcode_status=processing with hls_path showing processing UI', async () => {
    const processingVod = {
      ...sampleVod,
      hls_path: '/media/vod/10/stream.m3u8',
      transcode_status: 'processing',
      transcode_progress: 80,
    }
    mockGetVOD.mockResolvedValue({ data: { data: processingVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Procesando video...')).toBeInTheDocument()
    })
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('renders pending transcode with hls_path showing processing UI', async () => {
    const pendingVod = {
      ...sampleVod,
      hls_path: '/media/vod/10/stream.m3u8',
      transcode_status: 'pending',
      transcode_progress: 0,
    }
    mockGetVOD.mockResolvedValue({ data: { data: pendingVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Procesando video...')).toBeInTheDocument()
    })
    // No progress bar when 0%
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('renders not available message when hls_path is null', async () => {
    mockGetVOD.mockResolvedValue({ data: { data: sampleVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText(/no está disponible para reproducción/i)).toBeInTheDocument()
    })
  })

  it('renders not available message for failed transcode', async () => {
    const failedVod = {
      ...sampleVod,
      hls_path: '/media/vod/10/stream.m3u8',
      transcode_status: 'failed',
    }
    mockGetVOD.mockResolvedValue({ data: { data: failedVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText(/no está disponible para reproducción/i)).toBeInTheDocument()
    })
  })

  it('renders the "content not ready" subtext', async () => {
    mockGetVOD.mockResolvedValue({ data: { data: sampleVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText(/El contenido aún no está listo/)).toBeInTheDocument()
    })
  })

  it('fetches continue watching with limit 50 on load', async () => {
    mockGetVOD.mockResolvedValue({ data: { data: sampleVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    expect(mockGetContinueWatching).toHaveBeenCalledWith(50)
  })

  it('does not show season/episode for non-episode VOD', async () => {
    mockGetVOD.mockResolvedValue({ data: { data: sampleVod } })
    render(<VODDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Temporada/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Episodio/)).not.toBeInTheDocument()
  })
})
