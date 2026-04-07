import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import VODPage from '@/app/(user)/vod/page'

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

const mockGetVODs = userAPI.getVODs as jest.Mock
const mockGetCategories = userAPI.getCategories as jest.Mock

const sampleVods = [
  {
    id: 1,
    title: 'Inception',
    poster_url: 'https://example.com/inception.jpg',
    year: 2010,
    rating: 8.8,
    duration: 8880,
    category: { id: 1, name: 'Sci-Fi' },
  },
  {
    id: 2,
    title: 'The Matrix',
    poster_url: null,
    year: 1999,
    rating: 8.7,
    duration: 8160,
    category: { id: 1, name: 'Sci-Fi' },
  },
]

const sampleCategories = [
  { id: 1, name: 'Sci-Fi' },
  { id: 2, name: 'Drama' },
]

describe('VODPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    i18n.changeLanguage('es')
    mockGetCategories.mockResolvedValue({ data: { data: sampleCategories } })
  })

  it('renders loading state initially', () => {
    mockGetVODs.mockImplementation(() => new Promise(() => {}))
    render(<VODPage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders page title', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByText('Peliculas')).toBeInTheDocument()
    })
  })

  it('renders VOD list with data', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    expect(screen.getByText('The Matrix')).toBeInTheDocument()
  })

  it('shows empty state when no VODs found', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByText(/no se encontraron peliculas/i)).toBeInTheDocument()
    })
  })

  it('renders VOD poster images', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      const img = screen.getByAltText('Inception')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/inception.jpg')
    })
  })

  it('renders correct links to VOD detail pages', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })

    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/vod/1')
    expect(hrefs).toContain('/vod/2')
  })

  it('renders year and rating for VODs', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByText('2010')).toBeInTheDocument()
    })
    expect(screen.getByText('8.8')).toBeInTheDocument()
    expect(screen.getByText('1999')).toBeInTheDocument()
    expect(screen.getByText('8.7')).toBeInTheDocument()
  })

  it('renders category filter dropdown', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByText('Todas las categorias')).toBeInTheDocument()
    })
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
    expect(screen.getByText('Drama')).toBeInTheDocument()
  })

  it('renders pagination when there are VODs', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 3 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  it('pagination triggers re-fetch', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 3 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => {
      expect(mockGetVODs).toHaveBeenCalledTimes(2)
    })
  })

  it('shows error toast when loading VODs fails', async () => {
    mockGetVODs.mockRejectedValue(new Error('Network error'))

    render(<VODPage />)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar peliculas')
    })
  })

  it('shows error toast when loading categories fails', async () => {
    mockGetCategories.mockRejectedValue(new Error('Network error'))
    mockGetVODs.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar categorias')
    })
  })

  it('renders search input', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })
  })

  it('search input change triggers re-fetch', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } })

    await waitFor(() => {
      expect(mockGetVODs).toHaveBeenCalledTimes(2)
    })
  })

  it('category change triggers re-fetch', async () => {
    mockGetVODs.mockResolvedValue({
      data: { data: sampleVods, meta: { pages: 1 } },
    })

    render(<VODPage />)

    await waitFor(() => {
      expect(screen.getByText('Todas las categorias')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '1' } })

    await waitFor(() => {
      expect(mockGetVODs).toHaveBeenCalledTimes(2)
    })
  })
})
