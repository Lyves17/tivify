import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from '@/components/ui/confirm-dialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    title: 'Delete Item',
    message: 'Are you sure you want to delete?',
  }

  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Delete Item')).not.toBeInTheDocument()
  })

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to delete?')).toBeInTheDocument()
  })

  it('calls onConfirm when clicking confirm button', () => {
    const onConfirm = jest.fn()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    // The confirm button text is "Eliminar" from i18n (common.delete)
    const deleteBtn = screen.getByRole('button', { name: /eliminar/i })
    fireEvent.click(deleteBtn)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when clicking cancel button', () => {
    const onCancel = jest.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    const cancelBtn = screen.getByText(/cancelar|cancel/i)
    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalled()
  })
})
