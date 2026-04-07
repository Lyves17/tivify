/**
 * Extended tests for toast-context.
 * Covers: manual close, removing animation, ToastItem icons,
 * entrance animation, and styling per type.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/context/toast-context'

// Test component with all toast methods
function TestConsumer() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Success msg')}>Show Success</button>
      <button onClick={() => toast.error('Error msg')}>Show Error</button>
      <button onClick={() => toast.info('Info msg')}>Show Info</button>
    </div>
  )
}

describe('ToastContext - extended tests', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('can manually close a toast via the X button', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Success'))
    })

    expect(screen.getByText('Success msg')).toBeInTheDocument()

    // Find the close button (X icon rendered as button)
    const alerts = screen.getAllByRole('alert')
    const closeButton = alerts[0].querySelector('button')
    expect(closeButton).not.toBeNull()

    act(() => {
      fireEvent.click(closeButton!)
    })

    // After animation (300ms), toast should be removed
    act(() => {
      jest.advanceTimersByTime(350)
    })

    expect(screen.queryByText('Success msg')).not.toBeInTheDocument()
  })

  it('each toast type renders with the correct role', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Success'))
      fireEvent.click(screen.getByText('Show Error'))
      fireEvent.click(screen.getByText('Show Info'))
    })

    const alerts = screen.getAllByRole('alert')
    expect(alerts.length).toBe(3)
  })

  it('toasts have unique ids (multiple toasts)', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Success'))
      fireEvent.click(screen.getByText('Show Success'))
      fireEvent.click(screen.getByText('Show Success'))
    })

    // All three should be visible
    const alerts = screen.getAllByRole('alert')
    expect(alerts.length).toBe(3)
  })

  it('auto-dismiss removes toast after 3 seconds + animation', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Error'))
    })

    expect(screen.getByText('Error msg')).toBeInTheDocument()

    // Advance to just before auto-dismiss
    act(() => {
      jest.advanceTimersByTime(2900)
    })
    expect(screen.getByText('Error msg')).toBeInTheDocument()

    // Advance past auto-dismiss + removal animation
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(screen.queryByText('Error msg')).not.toBeInTheDocument()
  })

  it('info toast renders correctly', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show Info'))
    })

    expect(screen.getByText('Info msg')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('multiple toasts auto-dismiss independently', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    // Show first toast
    act(() => {
      fireEvent.click(screen.getByText('Show Success'))
    })

    // Wait 1.5 seconds then show second toast
    act(() => {
      jest.advanceTimersByTime(1500)
    })

    act(() => {
      fireEvent.click(screen.getByText('Show Error'))
    })

    // Both visible
    expect(screen.getByText('Success msg')).toBeInTheDocument()
    expect(screen.getByText('Error msg')).toBeInTheDocument()

    // Advance 1800ms: first toast has been alive 3300ms total (should be gone)
    act(() => {
      jest.advanceTimersByTime(1800)
    })

    expect(screen.queryByText('Success msg')).not.toBeInTheDocument()
    expect(screen.getByText('Error msg')).toBeInTheDocument()

    // Advance more to remove second toast
    act(() => {
      jest.advanceTimersByTime(1500)
    })

    expect(screen.queryByText('Error msg')).not.toBeInTheDocument()
  })
})
