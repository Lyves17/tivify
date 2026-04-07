import { renderHook } from '@testing-library/react'
import { useWSEvent } from '@/lib/use-ws-event'
import { wsClient } from '@/lib/websocket'

// wsClient is already mocked globally in jest.setup.js

describe('useWSEvent', () => {
  const mockOn = wsClient.on as jest.MockedFunction<typeof wsClient.on>
  const mockUnsubscribe = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockOn.mockReturnValue(mockUnsubscribe)
  })

  it('subscribes to the specified event type on mount', () => {
    const handler = jest.fn()
    renderHook(() => useWSEvent('transcode.progress', handler))

    expect(mockOn).toHaveBeenCalledTimes(1)
    expect(mockOn).toHaveBeenCalledWith('transcode.progress', handler)
  })

  it('returns void', () => {
    const handler = jest.fn()
    const { result } = renderHook(() => useWSEvent('test.event', handler))
    expect(result.current).toBeUndefined()
  })

  it('unsubscribes on unmount', () => {
    const handler = jest.fn()
    const { unmount } = renderHook(() => useWSEvent('test.event', handler))

    expect(mockUnsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('re-subscribes when event type changes', () => {
    const handler = jest.fn()
    const { rerender } = renderHook(
      ({ type }) => useWSEvent(type, handler),
      { initialProps: { type: 'event.a' } }
    )

    expect(mockOn).toHaveBeenCalledTimes(1)
    expect(mockOn).toHaveBeenCalledWith('event.a', handler)

    // Change event type
    rerender({ type: 'event.b' })

    // Should unsubscribe from old and subscribe to new
    expect(mockUnsubscribe).toHaveBeenCalled()
    expect(mockOn).toHaveBeenCalledTimes(2)
    expect(mockOn).toHaveBeenLastCalledWith('event.b', handler)
  })

  it('does not re-subscribe when handler reference changes but type stays same', () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    const { rerender } = renderHook(
      ({ handler }) => useWSEvent('same.type', handler),
      { initialProps: { handler: handler1 } }
    )

    expect(mockOn).toHaveBeenCalledTimes(1)

    // Change handler but keep same type - useEffect depends only on type
    rerender({ handler: handler2 })

    // Should NOT re-subscribe because dependency array only has [type]
    expect(mockOn).toHaveBeenCalledTimes(1)
  })

  it('works with typed events', () => {
    interface ProgressData {
      progress: number
      status: string
    }

    const handler = jest.fn()
    renderHook(() => useWSEvent<ProgressData>('transcode.progress', handler))

    expect(mockOn).toHaveBeenCalledWith('transcode.progress', handler)
  })
})
