// websocket.ts is mocked in jest.setup.js, so we test the mock behavior
// and also test the WebSocket types/interfaces

import { wsClient, WSEvent } from '@/lib/websocket'

describe('WebSocket client (mocked)', () => {
  it('wsClient is defined', () => {
    expect(wsClient).toBeDefined()
  })

  it('has connect method', () => {
    expect(typeof wsClient.connect).toBe('function')
  })

  it('has disconnect method', () => {
    expect(typeof wsClient.disconnect).toBe('function')
  })

  it('has on method for event subscription', () => {
    expect(typeof wsClient.on).toBe('function')
  })

  it('has onAny method for global subscription', () => {
    expect(typeof wsClient.onAny).toBe('function')
  })

  it('on returns unsubscribe function', () => {
    const unsub = wsClient.on('test', () => {})
    expect(typeof unsub).toBe('function')
  })

  it('onAny returns unsubscribe function', () => {
    const unsub = wsClient.onAny(() => {})
    expect(typeof unsub).toBe('function')
  })
})

describe('WSEvent type', () => {
  it('can create a typed event', () => {
    const event: WSEvent<{ progress: number }> = {
      type: 'transcode.progress',
      data: { progress: 50 },
    }
    expect(event.type).toBe('transcode.progress')
    expect(event.data.progress).toBe(50)
  })
})
