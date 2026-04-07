import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import GlobalError from '@/app/error'

describe('GlobalError', () => {
  const mockReset = jest.fn()
  const mockError = new Error('Test error') as Error & { digest?: string }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    ;(console.error as jest.Mock).mockRestore()
  })

  it('renders error title', () => {
    render(<GlobalError error={mockError} reset={mockReset} />)
    expect(screen.getByText('Algo salio mal')).toBeInTheDocument()
  })

  it('renders error message', () => {
    render(<GlobalError error={mockError} reset={mockReset} />)
    expect(
      screen.getByText('Ha ocurrido un error inesperado. Por favor intenta de nuevo.')
    ).toBeInTheDocument()
  })

  it('renders retry button', () => {
    render(<GlobalError error={mockError} reset={mockReset} />)
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
  })

  it('calls reset when retry button is clicked', () => {
    render(<GlobalError error={mockError} reset={mockReset} />)
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('logs the error to console', () => {
    render(<GlobalError error={mockError} reset={mockReset} />)
    expect(console.error).toHaveBeenCalledWith('Global error:', mockError)
  })

  it('handles error with digest property', () => {
    const digestError = Object.assign(new Error('Digest error'), { digest: 'abc123' })
    render(<GlobalError error={digestError} reset={mockReset} />)
    expect(screen.getByText('Algo salio mal')).toBeInTheDocument()
  })
})
