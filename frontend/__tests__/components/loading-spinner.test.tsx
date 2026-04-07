import { render, screen } from '@testing-library/react'
import LoadingSpinner from '@/components/ui/loading-spinner'

describe('LoadingSpinner', () => {
  it('renders with default text', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  it('renders with custom text', () => {
    render(<LoadingSpinner text="Loading data..." />)
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('has aria-label for accessibility', () => {
    render(<LoadingSpinner text="Please wait" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Please wait')
  })

  it('has polite aria-live', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})
