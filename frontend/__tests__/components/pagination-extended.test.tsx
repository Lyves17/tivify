/**
 * Extended tests for Pagination component — covers all getPageNumbers branches
 * and scroll-to-top behavior.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from '@/components/ui/pagination'

// Mock window.scrollTo
beforeAll(() => {
  window.scrollTo = jest.fn()
})

describe('Pagination - getPageNumbers branches', () => {
  it('total <= 5: renders all pages without ellipsis', () => {
    render(<Pagination page={3} totalPages={5} onPageChange={jest.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.queryByText('...')).not.toBeInTheDocument()
  })

  it('current <= 3: shows 1,2,3,4,...,total', () => {
    render(<Pagination page={2} totalPages={10} onPageChange={jest.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getAllByText('...').length).toBe(1)
  })

  it('current >= total - 2: shows 1,...,total-3,total-2,total-1,total', () => {
    render(<Pagination page={8} totalPages={10} onPageChange={jest.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getAllByText('...').length).toBe(1)
  })

  it('current in middle: shows 1,...,current-1,current,current+1,...,total', () => {
    render(<Pagination page={5} totalPages={10} onPageChange={jest.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getAllByText('...').length).toBe(2)
  })

  it('current = total - 2: uses end branch (1,...,total-3,...)', () => {
    render(<Pagination page={8} totalPages={10} onPageChange={jest.fn()} />)
    // page=8, total=10, 8 >= 10-2=8, so end branch
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('current = 3: uses start branch', () => {
    render(<Pagination page={3} totalPages={10} onPageChange={jest.fn()} />)
    // page=3, 3 <= 3, so start branch: 1,2,3,4,...,10
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })
})

describe('Pagination - scroll behavior', () => {
  it('scrolls to top when page is changed via page number', () => {
    const onPageChange = jest.fn()
    render(<Pagination page={3} totalPages={10} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByText('4'))
    expect(onPageChange).toHaveBeenCalledWith(4)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('scrolls to top when previous button is clicked', () => {
    const onPageChange = jest.fn()
    render(<Pagination page={3} totalPages={10} onPageChange={onPageChange} />)

    const prevBtn = screen.getByLabelText(/anterior|previous/i)
    fireEvent.click(prevBtn)
    expect(onPageChange).toHaveBeenCalledWith(2)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('scrolls to top when next button is clicked', () => {
    const onPageChange = jest.fn()
    render(<Pagination page={3} totalPages={10} onPageChange={onPageChange} />)

    const nextBtn = screen.getByLabelText(/siguiente|next/i)
    fireEvent.click(nextBtn)
    expect(onPageChange).toHaveBeenCalledWith(4)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})

describe('Pagination - edge cases', () => {
  it('totalPages=0 renders nothing', () => {
    const { container } = render(
      <Pagination page={1} totalPages={0} onPageChange={jest.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('totalPages=2 renders both pages without ellipsis', () => {
    render(<Pagination page={1} totalPages={2} onPageChange={jest.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('...')).not.toBeInTheDocument()
  })

  it('non-current page does not have aria-current', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={jest.fn()} />)
    const page2Btn = screen.getByText('2')
    expect(page2Btn).not.toHaveAttribute('aria-current')
  })
})
