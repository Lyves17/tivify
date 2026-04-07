import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from '@/components/ui/pagination'

// Mock window.scrollTo
beforeAll(() => {
  window.scrollTo = jest.fn()
})

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={jest.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders page buttons for small total', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={jest.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows ellipsis for large page counts', () => {
    render(<Pagination page={1} totalPages={10} onPageChange={jest.fn()} />)
    expect(screen.getByText('...')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('calls onPageChange when clicking a page', () => {
    const onPageChange = jest.fn()
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('3'))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('disables previous button on first page', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={jest.fn()} />)
    const prevBtn = screen.getByLabelText(/anterior|previous/i)
    expect(prevBtn).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(<Pagination page={5} totalPages={5} onPageChange={jest.fn()} />)
    const nextBtn = screen.getByLabelText(/siguiente|next/i)
    expect(nextBtn).toBeDisabled()
  })

  it('marks current page with aria-current', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={jest.fn()} />)
    const currentBtn = screen.getByText('2')
    expect(currentBtn).toHaveAttribute('aria-current', 'page')
  })

  it('has navigation role', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={jest.fn()} />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
