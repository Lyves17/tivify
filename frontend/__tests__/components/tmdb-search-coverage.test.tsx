/**
 * Additional coverage tests for TMDBSearchButton.
 * Covers uncovered lines:
 *   - Line 97: Modal onClose={() => setOpen(false))
 *   - Line 125: onChange={(e) => setType(e.target.value)} on the type FormSelect
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

describe('TMDBSearchButton - modal close and type change', () => {
  const mockOnSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('closes modal via the Modal close button (line 97 onClose)', async () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    // Open modal
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Close via the close button (aria-label "Cerrar")
    const closeBtn = screen.getByRole('button', { name: /cerrar/i })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes modal via backdrop click (line 97 onClose)', async () => {
    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Click the backdrop (the div with bg-black/60)
    const backdrop = document.querySelector('.bg-black\\/60')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('changes type select value (line 125 onChange)', async () => {
    mockSearchTMDB.mockResolvedValue({
      data: { data: [] },
    } as any)

    render(<TMDBSearchButton onSelect={mockOnSelect} initialQuery="test" />)
    fireEvent.click(screen.getByText('Buscar en TMDB'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Find the type select by its id (tmdb_t)
    const typeSelect = document.getElementById('tmdb_t') as HTMLSelectElement
    expect(typeSelect).toBeInTheDocument()
    expect(typeSelect.value).toBe('movie')

    // Change to series
    fireEvent.change(typeSelect, { target: { value: 'series' } })
    expect(typeSelect.value).toBe('series')

    // Search with the new type
    await act(async () => {
      fireEvent.click(screen.getByText('Buscar'))
    })

    await waitFor(() => {
      expect(mockSearchTMDB).toHaveBeenCalledWith('test', 0, 'series')
    })
  })
})
