import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import HomePage from '@/app/(user)/home/page'

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

import { userAPI } from '@/lib/api'

const mockGetContinueWatching = userAPI.getContinueWatching as jest.Mock

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    i18n.changeLanguage('es')
  })

  it('renders loading state initially', () => {
    mockGetContinueWatching.mockImplementation(() => new Promise(() => {}))
    render(<HomePage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders page title after loading', async () => {
    mockGetContinueWatching.mockResolvedValue({
      data: { data: [] },
    })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByText('Inicio')).toBeInTheDocument()
    })
  })

  it('shows continue watching section with data', async () => {
    mockGetContinueWatching.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            content_id: 10,
            content_type: 'vod',
            content_name: 'Test Movie',
            content_poster: 'https://example.com/poster.jpg',
            progress: 600,
            duration: 7200,
            watched_at: '2024-01-01T12:00:00Z',
          },
          {
            id: 2,
            content_id: 20,
            content_type: 'vod',
            content_name: 'Another Movie',
            content_poster: null,
            progress: 300,
            duration: 5400,
            watched_at: '2024-01-02T12:00:00Z',
          },
        ],
      },
    })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByText('Continuar viendo')).toBeInTheDocument()
    })

    expect(screen.getByText('Test Movie')).toBeInTheDocument()
    expect(screen.getByText('Another Movie')).toBeInTheDocument()
  })

  it('shows empty state when no continue watching', async () => {
    mockGetContinueWatching.mockResolvedValue({
      data: { data: [] },
    })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByText(/aun no has empezado/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/explora peliculas/i)).toBeInTheDocument()
  })

  it('renders explore section with category links', async () => {
    mockGetContinueWatching.mockResolvedValue({
      data: { data: [] },
    })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByText('Explorar')).toBeInTheDocument()
    })

    // Check the three explore cards
    expect(screen.getByText('Canales')).toBeInTheDocument()
    expect(screen.getByText('Peliculas')).toBeInTheDocument()
    expect(screen.getByText('Series')).toBeInTheDocument()

    // Check links
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/channels')
    expect(hrefs).toContain('/vod')
    expect(hrefs).toContain('/series')
  })

  it('renders poster images for items with poster_url', async () => {
    mockGetContinueWatching.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            content_id: 10,
            content_type: 'vod',
            content_name: 'With Poster',
            content_poster: 'https://example.com/poster.jpg',
            progress: 100,
            duration: 1000,
            watched_at: '2024-01-01T12:00:00Z',
          },
        ],
      },
    })

    render(<HomePage />)

    await waitFor(() => {
      const img = screen.getByAltText('Poster for With Poster')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/poster.jpg')
    })
  })

  it('links continue watching items to /vod/:id', async () => {
    mockGetContinueWatching.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            content_id: 42,
            content_type: 'vod',
            content_name: 'Test Movie',
            content_poster: null,
            progress: 100,
            duration: 1000,
            watched_at: '2024-01-01T12:00:00Z',
          },
        ],
      },
    })

    render(<HomePage />)

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /continue watching: test movie/i })
      expect(link).toHaveAttribute('href', '/vod/42')
    })
  })

  it('shows placeholder when item has zero duration', async () => {
    mockGetContinueWatching.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            content_id: 10,
            content_type: 'vod',
            content_name: 'Zero Duration',
            content_poster: null,
            progress: 50,
            duration: 0,
            watched_at: '2024-01-01T12:00:00Z',
          },
        ],
      },
    })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByText('Zero Duration')).toBeInTheDocument()
    })
    // No poster → should show Film icon placeholder
    expect(screen.getByRole('img', { name: /no poster/i })).toBeInTheDocument()
  })

  it('handles API error gracefully', async () => {
    mockGetContinueWatching.mockRejectedValue(new Error('Network error'))

    render(<HomePage />)

    // Should still render the page without crashing
    await waitFor(() => {
      expect(screen.getByText('Inicio')).toBeInTheDocument()
    })
  })
})
