import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import SeriesPage from '@/app/(user)/series/page'

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
jest.mock('@/components/ui/search-input', () => {
  return function MockSearchInput({ value, onChange, placeholder }: any) {
    return (
      <input
        data-testid="search-input"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
      />
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

const mockGetSeries = userAPI.getSeries as jest.Mock
const mockGetCategories = userAPI.getCategories as jest.Mock

const sampleSeries = [
  {
    id: 1,
    title: 'Breaking Bad',
    poster_url: 'https://example.com/bb.jpg',
    year: 2008,
    rating: 9.5,
    total_seasons: 5,
    episodes_count: 62,
    category: { id: 1, name: 'Drama' },
  },
  {
    id: 2,
    title: 'The Office',
    poster_url: null,
    year: 2005,
    rating: 8.9,
    total_seasons: 9,
    episodes_count: 201,
    category: { id: 2, name: 'Comedia' },
  },
]

const sampleCategories = [
  { id: 1, name: 'Drama' },
  { id: 2, name: 'Comedia' },
]

describe('SeriesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    i18n.changeLanguage('es')
    mockGetCategories.mockResolvedValue({ data: { data: sampleCategories } })
  })

  it('renders loading state initially', () => {
    mockGetSeries.mockImplementation(() => new Promise(() => {}))
    render(<SeriesPage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders page title', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Series')).toBeInTheDocument()
    })
  })

  it('renders series list with data', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    expect(screen.getByText('The Office')).toBeInTheDocument()
  })

  it('shows empty state when no series found', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText(/no se encontraron series/i)).toBeInTheDocument()
    })
  })

  it('renders series poster images', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      const img = screen.getByAltText('Breaking Bad')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/bb.jpg')
    })
  })

  it('renders correct links to series detail pages', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })

    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/series/1')
    expect(hrefs).toContain('/series/2')
  })

  it('renders year and rating for series', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText('2008')).toBeInTheDocument()
    })
    expect(screen.getByText('9.5')).toBeInTheDocument()
    expect(screen.getByText('2005')).toBeInTheDocument()
    expect(screen.getByText('8.9')).toBeInTheDocument()
  })

  it('renders episodes count badges', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText(/62 episodios/)).toBeInTheDocument()
    })
    expect(screen.getByText(/201 episodios/)).toBeInTheDocument()
  })

  it('renders season count', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText(/5 temporadas/)).toBeInTheDocument()
    })
    expect(screen.getByText(/9 temporadas/)).toBeInTheDocument()
  })

  it('renders singular form for 1 episode', async () => {
    const singleEpSeries = [
      { ...sampleSeries[0], episodes_count: 1 },
    ]
    mockGetSeries.mockResolvedValue({
      data: { data: singleEpSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText(/1 episodio$/)).toBeInTheDocument()
    })
  })

  it('renders singular form for 1 season', async () => {
    const singleSeasonSeries = [
      { ...sampleSeries[0], total_seasons: 1 },
    ]
    mockGetSeries.mockResolvedValue({
      data: { data: singleSeasonSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText(/1 temporada$/)).toBeInTheDocument()
    })
  })

  it('renders category filter dropdown', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Todas las categorias')).toBeInTheDocument()
    })
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Comedia')).toBeInTheDocument()
  })

  it('renders pagination when there are series', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 3 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('pagination triggers re-fetch', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 3 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => {
      expect(mockGetSeries).toHaveBeenCalledTimes(2)
    })
  })

  it('shows error toast when loading series fails', async () => {
    mockGetSeries.mockRejectedValue(new Error('Network error'))

    render(<SeriesPage />)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar series')
    })
  })

  it('shows error toast when loading categories fails', async () => {
    mockGetCategories.mockRejectedValue(new Error('Network error'))
    mockGetSeries.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar categorias')
    })
  })

  it('renders search input', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })
  })

  it('search input change triggers re-fetch', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } })

    await waitFor(() => {
      expect(mockGetSeries).toHaveBeenCalledTimes(2)
    })
  })

  it('category change triggers re-fetch', async () => {
    mockGetSeries.mockResolvedValue({
      data: { data: sampleSeries, meta: { pages: 1 } },
    })

    render(<SeriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Todas las categorias')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '1' } })

    await waitFor(() => {
      expect(mockGetSeries).toHaveBeenCalledTimes(2)
    })
  })
})
