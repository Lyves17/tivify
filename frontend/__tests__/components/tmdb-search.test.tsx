import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import TMDBSearchButton from '@/components/ui/tmdb-search'
import { adminAPI } from '@/lib/api'

jest.mock('@/lib/api')
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />
  },
}))

const mockSearchTMDB = adminAPI.searchTMDB as jest.MockedFunction<typeof adminAPI.searchTMDB>

const mockResults = [
  {
    id: 1,
    title: 'Inception',
    overview: 'A mind-bending thriller',
    poster_url: 'https://image.tmdb.org/poster1.jpg',
    backdrop_url: 'https://image.tmdb.org/backdrop1.jpg',
    year: 2010,
    rating: 8.8,
  },
  {
    id: 2,
    title: 'Interstellar',
    overview: 'Space exploration epic',
    poster_url: '',
    backdrop_url: '',
    year: 2014,
    rating: 0,
  },
]

describe('TMDBSearchButton', () => {
  const mockOnSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the button with TMDB text', () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} />)
    expect(screen.getByText('Buscar en TMDB')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} className="custom-class" />)
    const button = screen.getByText('Buscar en TMDB').closest('button')
    expect(button).toHaveClass('custom-class')
  })

  it('opens modal when button is clicked', () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    // Modal should be open with title
    expect(screen.getAllByText('Buscar en TMDB').length).toBeGreaterThanOrEqual(1)
  })

  it('pre-fills query from initialQuery prop', () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="Matrix" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    const input = screen.getByPlaceholderText('Buscar pelicula o serie...')
    expect(input).toHaveValue('Matrix')
  })

  it('disables search button when query is empty', () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    const searchBtn = screen.getByText('Buscar')
    expect(searchBtn).toBeDisabled()
  })

  it('enables search button when query has text', () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="Test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    const searchBtn = screen.getByText('Buscar')
    expect(searchBtn).not.toBeDisabled()
  })

  it('calls adminAPI.searchTMDB on search button click', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: mockResults },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="Inception" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    const searchBtn = screen.getByText('Buscar')
    await act(async () => {
      fireEvent.click(searchBtn)
    })

    await waitFor(() => {
      expect(mockSearchTMDB).toHaveBeenCalledWith('Inception', 0, 'movie')
    })
  })

  it('passes year parameter when year is filled', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: mockResults },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="Inception" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    const yearInput = screen.getByPlaceholderText('Año')
    fireEvent.change(yearInput, { target: { value: '2010' } })

    const searchBtn = screen.getByText('Buscar')
    await act(async () => {
      fireEvent.click(searchBtn)
    })

    await waitFor(() => {
      expect(mockSearchTMDB).toHaveBeenCalledWith('Inception', 2010, 'movie')
    })
  })

  it('renders search results after successful search', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: mockResults },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="Inception" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
      expect(screen.getByText('Interstellar')).toBeInTheDocument()
    })
  })

  it('displays year and rating for results', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: mockResults },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(screen.getByText(/2010/)).toBeInTheDocument()
      expect(screen.getByText(/8\.8\/10/)).toBeInTheDocument()
      expect(screen.getByText(/Sin rating/)).toBeInTheDocument()
    })
  })

  it('displays overview text for results', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: mockResults },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(screen.getByText('A mind-bending thriller')).toBeInTheDocument()
      expect(screen.getByText('Space exploration epic')).toBeInTheDocument()
    })
  })

  it('calls onSelect with correct data when result is clicked', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: mockResults },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Inception'))

    expect(mockOnSelect).toHaveBeenCalledWith({
      title: 'Inception',
      description: 'A mind-bending thriller',
      year: 2010,
      rating: 8.8,
      poster_url: 'https://image.tmdb.org/poster1.jpg',
      backdrop_url: 'https://image.tmdb.org/backdrop1.jpg',
    })
  })

  it('shows empty state when no results found', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: [] },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="nonexistent" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(screen.getByText(/Sin resultados/)).toBeInTheDocument()
    })
  })

  it('handles API error gracefully', async () => {
    mockSearchTMDB.mockRejectedValue(new Error('Network error'))

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(screen.getByText(/Sin resultados/)).toBeInTheDocument()
    })
  })

  it('does not search when query is empty/whitespace', async () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    // Type only spaces
    const input = screen.getByPlaceholderText('Buscar pelicula o serie...')
    fireEvent.change(input, { target: { value: '   ' } })

    // Search button should be disabled
    const searchBtn = screen.getByText('Buscar')
    expect(searchBtn).toBeDisabled()
  })

  it('triggers search on Enter key press in query input', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: mockResults },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    // The keyDown handler is on the parent div, find the input and trigger on its container
    const input = screen.getByPlaceholderText('Buscar pelicula o serie...')
    await act(async () => {
      fireEvent.keyDown(input.closest('div[class*="flex-1"]')!, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(mockSearchTMDB).toHaveBeenCalled()
    })
  })

  it('does not trigger search on non-Enter keys', async () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    const input = screen.getByPlaceholderText('Buscar pelicula o serie...')
    fireEvent.keyDown(input.closest('div[class*="flex-1"]')!, { key: 'a' })

    expect(mockSearchTMDB).not.toHaveBeenCalled()
  })

  it('renders poster image when poster_url is provided', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: [mockResults[0]] },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      const img = screen.getByAltText('Inception')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://image.tmdb.org/poster1.jpg')
    })
  })

  it('handles null data from API response', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: null },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(screen.getByText(/Sin resultados/)).toBeInTheDocument()
    })
  })

  it('uses mediaType prop for search type', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: [] },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" mediaType="series" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(mockSearchTMDB).toHaveBeenCalledWith('test', 0, 'series')
    })
  })

  it('resets state when modal is re-opened', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: mockResults },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)

    // Open and search
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })

    // Select a result to close modal
    fireEvent.click(screen.getByText('Inception'))

    // Re-open - results should be cleared
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    expect(screen.queryByText('Inception')).not.toBeInTheDocument()
  })
})
