import React from 'react'
import { render, screen } from '@testing-library/react'
import NotFound from '@/app/not-found'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

describe('NotFound', () => {
  it('renders 404 text', () => {
    render(<NotFound />)
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders not found title', () => {
    render(<NotFound />)
    expect(screen.getByText('Pagina no encontrada')).toBeInTheDocument()
  })

  it('renders not found message', () => {
    render(<NotFound />)
    expect(
      screen.getByText('La pagina que buscas no existe o ha sido movida.')
    ).toBeInTheDocument()
  })

  it('renders link back to home', () => {
    render(<NotFound />)
    const link = screen.getByRole('link', { name: /volver al inicio/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })
})
