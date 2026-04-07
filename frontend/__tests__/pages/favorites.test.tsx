import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import FavoritesPage from '@/app/(user)/favorites/page'

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

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}
jest.mock('@/context/toast-context', () => ({
  useToast: () => mockToast,
}))

import { userAPI } from '@/lib/api'

const mockGetFavorites = userAPI.getFavorites as jest.Mock
const mockToggleFavorite = userAPI.toggleFavorite as jest.Mock

const sampleFavorites = [
  {
    id: 1,
    user_id: 'u1',
    favoritable_type: 'vod',
    favoritable_id: 10,
    content_name: 'Test Movie',
    content_poster: 'https://example.com/poster.jpg',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    user_id: 'u1',
    favoritable_type: 'channel',
    favoritable_id: 20,
    content_name: 'ESPN',
    content_poster: null,
    created_at: '2024-01-16T10:00:00Z',
  },
  {
    id: 3,
    user_id: 'u1',
    favoritable_type: 'series',
    favoritable_id: 30,
    content_name: 'Breaking Bad',
    content_poster: 'https://example.com/bb.jpg',
    created_at: '2024-01-17T10:00:00Z',
  },
]

describe('FavoritesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockToggleFavorite.mockResolvedValue({ data: { data: { added: false } } })
    i18n.changeLanguage('es')
  })

  it('renders loading state initially', () => {
    mockGetFavorites.mockImplementation(() => new Promise(() => {}))
    render(<FavoritesPage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders page title', async () => {
    mockGetFavorites.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText('Favoritos')).toBeInTheDocument()
    })
  })

  it('renders favorites list with data', async () => {
    mockGetFavorites.mockResolvedValue({
      data: {
        data: sampleFavorites,
        meta: { pages: 1 },
      },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Movie')).toBeInTheDocument()
    })
    expect(screen.getByText('ESPN')).toBeInTheDocument()
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
  })

  it('shows empty state when no favorites', async () => {
    mockGetFavorites.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText(/no tienes favoritos/i)).toBeInTheDocument()
    })
  })

  it('renders type badges for each favorite type', async () => {
    mockGetFavorites.mockResolvedValue({
      data: {
        data: sampleFavorites,
        meta: { pages: 1 },
      },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Pelicula').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('Canal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Serie').length).toBeGreaterThan(0)
  })

  it('renders correct links for each favorite type', async () => {
    mockGetFavorites.mockResolvedValue({
      data: {
        data: sampleFavorites,
        meta: { pages: 1 },
      },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Movie')).toBeInTheDocument()
    })

    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/vod/10')
    expect(hrefs).toContain('/channels/20')
    expect(hrefs).toContain('/series/30')
  })

  it('renders pagination when there are favorites', async () => {
    mockGetFavorites.mockResolvedValue({
      data: {
        data: sampleFavorites,
        meta: { pages: 3 },
      },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('does not render pagination when empty', async () => {
    mockGetFavorites.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText(/no tienes favoritos/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()
  })

  it('remove favorite button calls toggleFavorite and removes item', async () => {
    mockGetFavorites.mockResolvedValue({
      data: {
        data: sampleFavorites,
        meta: { pages: 1 },
      },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Movie')).toBeInTheDocument()
    })

    // Click first delete button
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockToggleFavorite).toHaveBeenCalledWith('vod', 10)
    })

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Eliminado de favoritos')
    })

    // Item should be removed from the list
    await waitFor(() => {
      expect(screen.queryByText('Test Movie')).not.toBeInTheDocument()
    })
  })

  it('shows error toast when remove fails', async () => {
    mockToggleFavorite.mockRejectedValue(new Error('fail'))
    mockGetFavorites.mockResolvedValue({
      data: {
        data: sampleFavorites,
        meta: { pages: 1 },
      },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Movie')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar favorito')
    })
  })

  it('shows error toast when loading favorites fails', async () => {
    mockGetFavorites.mockRejectedValue(new Error('Network error'))

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar favoritos')
    })
  })

  it('handles unknown favorite type with default badge and link', async () => {
    const unknownFav = {
      id: 99,
      user_id: 'u1',
      favoritable_type: 'podcast',
      favoritable_id: 99,
      content_name: 'Unknown Favorite',
      content_poster: null,
      created_at: '2024-01-20T10:00:00Z',
    }
    mockGetFavorites.mockResolvedValue({
      data: {
        data: [unknownFav],
        meta: { pages: 1 },
      },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText('Unknown Favorite')).toBeInTheDocument()
    })
    // Default type label returns the raw type string
    expect(screen.getByText('podcast')).toBeInTheDocument()
    // Default href should be "#"
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('#')
  })

  it('pagination triggers re-fetch', async () => {
    mockGetFavorites.mockResolvedValue({
      data: {
        data: sampleFavorites,
        meta: { pages: 3 },
      },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })

    // Click the next button in our mock pagination
    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => {
      // Should be called twice: initial + pagination change
      expect(mockGetFavorites).toHaveBeenCalledTimes(2)
    })
  })

  it('handles null data from API (covers || [] branch)', async () => {
    mockGetFavorites.mockResolvedValue({
      data: { data: null, meta: { pages: 1 } },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText(/no tienes favoritos/i)).toBeInTheDocument()
    })
  })

  it('renders dates in English locale', async () => {
    i18n.changeLanguage('en')
    mockGetFavorites.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            favoritable_type: 'channel',
            favoritable_id: 1,
            content_name: 'ESPN',
            content_poster: null,
            created_at: '2024-06-15T12:00:00Z',
          },
        ],
        meta: { pages: 1 },
      },
    })

    render(<FavoritesPage />)

    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    i18n.changeLanguage('es') // restore
  })
})
