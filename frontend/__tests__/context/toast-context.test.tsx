import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/context/toast-context'

// Test component that exposes toast functions
function TestConsumer() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Success message')}>Show Success</button>
      <button onClick={() => toast.error('Error message')}>Show Error</button>
      <button onClick={() => toast.info('Info message')}>Show Info</button>
    </div>
  )
}

describe('ToastContext', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders children', () => {
    render(
      <ToastProvider>
        <p>Child content</p>
      </ToastProvider>
    )
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('throws when useToast is used outside provider', () => {
    // Suppress console.error for expected error
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      render(<TestConsumer />)
    }).toThrow('useToast debe usarse dentro de ToastProvider')
    spy.mockRestore()
  })

  it('shows success toast', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Success'))
    })

    expect(screen.getByText('Success message')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows error toast', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Error'))
    })

    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('shows info toast', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Info'))
    })

    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  it('auto-dismisses toast after 3 seconds', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Success'))
    })

    expect(screen.getByText('Success message')).toBeInTheDocument()

    // Advance past auto-dismiss (3000ms) + removal animation (300ms)
    act(() => {
      jest.advanceTimersByTime(3300)
    })

    expect(screen.queryByText('Success message')).not.toBeInTheDocument()
  })

  it('can show multiple toasts', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Success'))
      fireEvent.click(screen.getByText('Show Error'))
    })

    expect(screen.getByText('Success message')).toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })
})
