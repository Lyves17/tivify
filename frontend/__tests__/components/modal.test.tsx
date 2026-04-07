import { render, screen, fireEvent } from '@testing-library/react'
import Modal from '@/components/ui/modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()} title="Test">
        <p>Content</p>
      </Modal>
    )
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders content when open', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal">
        <p>Modal content here</p>
      </Modal>
    )
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal content here')).toBeInTheDocument()
  })

  it('has dialog role and aria-modal', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Dialog">
        <p>Body</p>
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose on Escape key', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when clicking backdrop', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>
    )
    // The backdrop is the first child div with the onClick
    const backdrop = screen.getByRole('dialog').querySelector('.absolute.inset-0')
    if (backdrop) fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('has close button', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>
    )
    const closeBtn = screen.getByLabelText(/cerrar|close/i)
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })
})
