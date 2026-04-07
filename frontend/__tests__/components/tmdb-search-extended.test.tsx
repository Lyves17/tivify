/**
 * Extended tests for TMDBSearchButton — covers Enter key in year input
 * and year=0 display.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import TMDBSearchButton from '@/components/ui/tmdb-search'
import { adminAPI } from '@/lib/api'

jest.mock('@/lib/api')
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))

const mockSearchTMDB = adminAPI.searchTMDB as jest.MockedFunction<typeof adminAPI.searchTMDB>

describe('TMDBSearchButton - year input Enter key', () => {
  const mockOnSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('triggers search on Enter key in year input', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: [] },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    // Find the year input container (the second onKeyDown wrapper, w-24)
    const yearInput = screen.getByPlaceholderText('Año')
    const yearContainer = yearInput.closest('div[class*="w-24"]')!

    await act(async () => {
      fireEvent.keyDown(yearContainer, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(mockSearchTMDB).toHaveBeenCalled()
    })
  })

  it('does not trigger search on non-Enter key in year input', async () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    const yearInput = screen.getByPlaceholderText('Año')
    const yearContainer = yearInput.closest('div[class*="w-24"]')!

    fireEvent.keyDown(yearContainer, { key: 'a' })

    expect(mockSearchTMDB).not.toHaveBeenCalled()
  })

  it('displays dash when result year is 0', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            title: 'Unknown Year Movie',
            overview: '',
            poster_url: '',
            backdrop_url: '',
            year: 0,
            rating: 5.0,
          },
        ],
      },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))

    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(screen.getByText('Unknown Year Movie')).toBeInTheDocument()
      // year=0 should show "—"
      expect(screen.getByText(/— ·/)).toBeInTheDocument()
    })
  })
})
