import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => ({
  AlertTriangle: (props: any) => <svg data-testid="alert-icon" {...props} />,
}))

describe('AdminError', () => {
  it('renders error message and retry button', () => {
    const AdminError = require('@/app/admin/error').default
    const reset = jest.fn()
    const error = new Error('test error')

    render(<AdminError error={error} reset={reset} />)

    expect(screen.getByText('Error en el panel')).toBeInTheDocument()
    expect(screen.getByText(/Ocurrio un error inesperado/)).toBeInTheDocument()
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Reintentar'))
    expect(reset).toHaveBeenCalled()
  })
})

describe('UserError', () => {
  it('renders error message and retry button', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const UserError = require('@/app/(user)/error').default
    const reset = jest.fn()
    const error = new Error('user error')

    render(<UserError error={error} reset={reset} />)

    expect(screen.getByText('Error al cargar la página')).toBeInTheDocument()
    expect(consoleSpy).toHaveBeenCalledWith('User section error:', error)

    fireEvent.click(screen.getByText('Reintentar'))
    expect(reset).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
