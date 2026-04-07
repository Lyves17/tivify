import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import HistoryPage from '@/app/(user)/history/page'

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

const mockGetHistory = userAPI.getHistory as jest.Mock
const mockDeleteHistory = userAPI.deleteHistory as jest.Mock

const sampleHistory = [
  {
    id: 1,
    content_id: 10,
    content_type: 'vod',
    content_name: 'Inception',
    content_poster: 'https://example.com/inception.jpg',
    progress: 3600,
    duration: 7200,
    watched_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    content_id: 20,
    content_type: 'channel',
    content_name: 'BBC News',
    content_poster: null,
    progress: 600,
    duration: 0,
    watched_at: '2024-01-16T10:00:00Z',
  },
]

describe('HistoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeleteHistory.mockResolvedValue({})
    i18n.changeLanguage('es')
  })

  it('renders loading state initially', () => {
    mockGetHistory.mockImplementation(() => new Promise(() => {}))
    render(<HistoryPage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders page title', async () => {
    mockGetHistory.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Historial')).toBeInTheDocument()
    })
  })

  it('renders watch history list', async () => {
    mockGetHistory.mockResolvedValue({
      data: {
        data: sampleHistory,
        meta: { pages: 1 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    expect(screen.getByText('BBC News')).toBeInTheDocument()
  })

  it('shows empty state when no history', async () => {
    mockGetHistory.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText(/no hay historial/i)).toBeInTheDocument()
    })
  })

  it('renders type badges (Pelicula, Canal)', async () => {
    mockGetHistory.mockResolvedValue({
      data: {
        data: sampleHistory,
        meta: { pages: 1 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Pelicula').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('Canal').length).toBeGreaterThan(0)
  })

  it('renders correct links for history entries', async () => {
    mockGetHistory.mockResolvedValue({
      data: {
        data: sampleHistory,
        meta: { pages: 1 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })

    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/vod/10')
    expect(hrefs).toContain('/channels/20')
  })

  it('delete entry calls deleteHistory and removes item', async () => {
    mockGetHistory.mockResolvedValue({
      data: {
        data: sampleHistory,
        meta: { pages: 1 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockDeleteHistory).toHaveBeenCalledWith(1)
    })

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Entrada eliminada del historial')
    })

    await waitFor(() => {
      expect(screen.queryByText('Inception')).not.toBeInTheDocument()
    })
  })

  it('shows error toast when delete fails', async () => {
    mockDeleteHistory.mockRejectedValue(new Error('fail'))
    mockGetHistory.mockResolvedValue({
      data: {
        data: sampleHistory,
        meta: { pages: 1 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al eliminar entrada')
    })
  })

  it('shows error toast when loading history fails', async () => {
    mockGetHistory.mockRejectedValue(new Error('Network error'))

    render(<HistoryPage />)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar historial')
    })
  })

  it('renders pagination when there is history', async () => {
    mockGetHistory.mockResolvedValue({
      data: {
        data: sampleHistory,
        meta: { pages: 3 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('does not render pagination when empty', async () => {
    mockGetHistory.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText(/no hay historial/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()
  })

  it('renders poster image for entries with poster', async () => {
    mockGetHistory.mockResolvedValue({
      data: {
        data: sampleHistory,
        meta: { pages: 1 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      const img = screen.getByAltText('Inception')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/inception.jpg')
    })
  })

  it('handles unknown content type with default badge and link', async () => {
    const unknownEntry = {
      id: 99,
      content_id: 99,
      content_type: 'podcast',
      content_name: 'Unknown Type Entry',
      content_poster: null,
      progress: 100,
      duration: 200,
      watched_at: '2024-01-20T10:00:00Z',
    }
    mockGetHistory.mockResolvedValue({
      data: {
        data: [unknownEntry],
        meta: { pages: 1 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Unknown Type Entry')).toBeInTheDocument()
    })
    // Default type label returns the raw type string
    expect(screen.getByText('podcast')).toBeInTheDocument()
    // Default href should be "#"
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('#')
  })

  it('pagination triggers re-fetch', async () => {
    mockGetHistory.mockResolvedValue({
      data: {
        data: sampleHistory,
        meta: { pages: 3 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => {
      expect(mockGetHistory).toHaveBeenCalledTimes(2)
    })
  })

  it('handles undefined data array from API (covers || [] branch)', async () => {
    mockGetHistory.mockResolvedValue({
      data: { data: undefined, meta: { pages: 0 } },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })
  })

  it('renders dates in English locale', async () => {
    i18n.changeLanguage('en')
    mockGetHistory.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            content_id: 10,
            content_type: 'vod',
            content_name: 'Test Movie',
            content_poster: null,
            progress: 600,
            duration: 7200,
            watched_at: '2024-06-15T12:00:00Z',
          },
        ],
        meta: { pages: 1 },
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Movie')).toBeInTheDocument()
    })
    i18n.changeLanguage('es') // restore
  })
})
