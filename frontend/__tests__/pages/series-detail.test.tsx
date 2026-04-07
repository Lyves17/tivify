import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import SeriesDetailPage from '@/app/(user)/series/[id]/page'

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

jest.mock('@/lib/utils', () => ({
  resolveUrl: (url: string) => url,
  formatDurationHuman: (s: number) => `${Math.floor(s / 60)}m`,
  formatDurationTimer: (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
}))

const mockParams = { id: '5' }
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

import { userAPI } from '@/lib/api'

const mockGetSeriesById = userAPI.getSeriesById as jest.Mock
const mockGetSeriesEpisodes = userAPI.getSeriesEpisodes as jest.Mock

const sampleSeries = {
  id: 5,
  title: 'Breaking Bad',
  poster_url: 'https://example.com/bb.jpg',
  description: 'A high school chemistry teacher turned meth maker.',
  year: 2008,
  rating: 9.5,
  total_seasons: 5,
  episodes_count: 62,
  category: { id: 1, name: 'Drama' },
}

const sampleEpisodes = [
  {
    id: 101,
    title: 'Pilot',
    season_number: 1,
    episode_number: 1,
    duration: 3480,
    rating: 9.0,
    description: 'Walter White starts his journey.',
    series_id: 5,
  },
  {
    id: 102,
    title: "Cat's in the Bag...",
    season_number: 1,
    episode_number: 2,
    duration: 2880,
    rating: 8.5,
    description: 'Dealing with the aftermath.',
    series_id: 5,
  },
  {
    id: 201,
    title: 'Seven Thirty-Seven',
    season_number: 2,
    episode_number: 1,
    duration: 2700,
    rating: 8.8,
    description: 'Season 2 begins.',
    series_id: 5,
  },
]

describe('SeriesDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    i18n.changeLanguage('es')
  })

  it('renders loading state initially', () => {
    mockGetSeriesById.mockImplementation(() => new Promise(() => {}))
    mockGetSeriesEpisodes.mockImplementation(() => new Promise(() => {}))
    render(<SeriesDetailPage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByText('Cargando serie...')).toBeInTheDocument()
  })

  it('renders series not found when API fails', async () => {
    mockGetSeriesById.mockRejectedValue(new Error('Not found'))
    mockGetSeriesEpisodes.mockRejectedValue(new Error('Not found'))

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Serie no encontrada')).toBeInTheDocument()
    })

    expect(screen.getByText('Volver a series')).toBeInTheDocument()
    expect(mockToast.error).toHaveBeenCalledWith('Error al cargar la serie')
  })

  it('renders series title and metadata after loading', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })

    expect(screen.getByText('2008')).toBeInTheDocument()
    expect(screen.getByText('9.5')).toBeInTheDocument()
    expect(screen.getByText(/5 temporadas/)).toBeInTheDocument()
    expect(screen.getByText('62 episodios')).toBeInTheDocument()
  })

  it('renders series description', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('A high school chemistry teacher turned meth maker.')).toBeInTheDocument()
    })
  })

  it('renders series category', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Drama')).toBeInTheDocument()
    })
  })

  it('renders series poster', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      const img = screen.getByAltText('Breaking Bad')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/bb.jpg')
    })
  })

  it('renders back link to series list', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      const links = screen.getAllByText('Volver a series')
      const link = links.find((el) => el.closest('a'))
      expect(link?.closest('a')).toHaveAttribute('href', '/series')
    })
  })

  it('renders season tabs', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('T1')).toBeInTheDocument()
    })
    expect(screen.getByText('T2')).toBeInTheDocument()
  })

  it('renders episodes for selected season', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Pilot')).toBeInTheDocument()
    })
    expect(screen.getByText("Cat's in the Bag...")).toBeInTheDocument()
    // Season 2 episode should not be visible initially (season 1 is selected)
    expect(screen.queryByText('Seven Thirty-Seven')).not.toBeInTheDocument()
  })

  it('switches seasons when clicking season tab', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('T2')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('T2'))

    await waitFor(() => {
      expect(screen.getByText('Seven Thirty-Seven')).toBeInTheDocument()
    })
    // Season 1 episodes should no longer be visible
    expect(screen.queryByText('Pilot')).not.toBeInTheDocument()
  })

  it('renders episode numbers', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('E1')).toBeInTheDocument()
    })
    expect(screen.getByText('E2')).toBeInTheDocument()
  })

  it('renders episode descriptions', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Walter White starts his journey.')).toBeInTheDocument()
    })
    expect(screen.getByText('Dealing with the aftermath.')).toBeInTheDocument()
  })

  it('renders links to episode detail pages', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Pilot')).toBeInTheDocument()
    })

    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/vod/101')
    expect(hrefs).toContain('/vod/102')
  })

  it('shows empty episodes message for season with no episodes', async () => {
    mockGetSeriesById.mockResolvedValue({ data: { data: sampleSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: [] } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('No hay episodios para esta temporada')).toBeInTheDocument()
    })
  })

  it('renders singular form for 1 season', async () => {
    const singleSeasonSeries = { ...sampleSeries, total_seasons: 1 }
    mockGetSeriesById.mockResolvedValue({ data: { data: singleSeasonSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText(/1 temporada$/)).toBeInTheDocument()
    })
  })

  it('does not render year when year is 0', async () => {
    const noYearSeries = { ...sampleSeries, year: 0 }
    mockGetSeriesById.mockResolvedValue({ data: { data: noYearSeries } })
    mockGetSeriesEpisodes.mockResolvedValue({ data: { data: sampleEpisodes } })

    render(<SeriesDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })

    // The year "0" or "2008" text should not be present
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
