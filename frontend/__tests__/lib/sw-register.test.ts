// Unmock sw-register for this test file (it's mocked globally in jest.setup.js)
jest.unmock('@/lib/sw-register')

describe('registerServiceWorker', () => {
  let registerServiceWorker: typeof import('@/lib/sw-register').registerServiceWorker

  const mockRegistration = {
    update: jest.fn(),
    installing: null as any,
    addEventListener: jest.fn(),
  }

  const mockRegister = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockRegister.mockResolvedValue(mockRegistration)
    mockRegistration.installing = null
    mockRegistration.addEventListener.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('does nothing when window is undefined', async () => {
    const originalWindow = global.window
    // @ts-ignore
    delete global.window

    // Re-import to get fresh module
    jest.resetModules()
    jest.unmock('@/lib/sw-register')
    const mod = await import('@/lib/sw-register')
    mod.registerServiceWorker()

    // Should not throw
    global.window = originalWindow
  })

  it('does nothing when serviceWorker is not in navigator', async () => {
    const originalServiceWorker = navigator.serviceWorker

    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    jest.resetModules()
    jest.unmock('@/lib/sw-register')
    const mod = await import('@/lib/sw-register')
    mod.registerServiceWorker()

    // Should not throw - just returns early
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
      writable: true,
    })
  })

  it('registers service worker on window load event', async () => {
    // Setup navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: null,
      },
      configurable: true,
      writable: true,
    })

    const loadListeners: Function[] = []
    const originalAddEventListener = window.addEventListener
    jest.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'load') {
        loadListeners.push(handler)
      }
    })

    jest.resetModules()
    jest.unmock('@/lib/sw-register')
    const mod = await import('@/lib/sw-register')
    mod.registerServiceWorker()

    expect(loadListeners.length).toBe(1)

    // Simulate load event
    await loadListeners[0]()

    expect(mockRegister).toHaveBeenCalledWith('/sw.js', { scope: '/' })

    window.addEventListener = originalAddEventListener
  })

  it('sets up periodic update check every 60 minutes', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: null,
      },
      configurable: true,
      writable: true,
    })

    const loadListeners: Function[] = []
    jest.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'load') {
        loadListeners.push(handler)
      }
    })

    jest.resetModules()
    jest.unmock('@/lib/sw-register')
    const mod = await import('@/lib/sw-register')
    mod.registerServiceWorker()

    await loadListeners[0]()

    // Advance 60 minutes
    jest.advanceTimersByTime(60 * 60 * 1000)
    expect(mockRegistration.update).toHaveBeenCalledTimes(1)

    // Advance another 60 minutes
    jest.advanceTimersByTime(60 * 60 * 1000)
    expect(mockRegistration.update).toHaveBeenCalledTimes(2)
  })

  it('listens for updatefound events on registration', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: null,
      },
      configurable: true,
      writable: true,
    })

    const loadListeners: Function[] = []
    jest.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'load') {
        loadListeners.push(handler)
      }
    })

    jest.resetModules()
    jest.unmock('@/lib/sw-register')
    const mod = await import('@/lib/sw-register')
    mod.registerServiceWorker()

    await loadListeners[0]()

    expect(mockRegistration.addEventListener).toHaveBeenCalledWith(
      'updatefound',
      expect.any(Function)
    )
  })

  it('handles updatefound with new installing worker', async () => {
    const mockNewWorker = {
      state: 'installing',
      addEventListener: jest.fn(),
    }
    mockRegistration.installing = mockNewWorker

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: { state: 'activated' }, // existing controller
      },
      configurable: true,
      writable: true,
    })

    const loadListeners: Function[] = []
    jest.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'load') {
        loadListeners.push(handler)
      }
    })

    jest.resetModules()
    jest.unmock('@/lib/sw-register')
    const mod = await import('@/lib/sw-register')
    mod.registerServiceWorker()

    await loadListeners[0]()

    // Trigger the updatefound handler
    const updateFoundHandler = mockRegistration.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'updatefound'
    )?.[1]
    expect(updateFoundHandler).toBeDefined()

    updateFoundHandler()

    // Should listen for statechange on the new worker
    expect(mockNewWorker.addEventListener).toHaveBeenCalledWith(
      'statechange',
      expect.any(Function)
    )
  })

  it('logs message when new worker is installed and controller exists', async () => {
    const mockNewWorker = {
      state: 'installed',
      addEventListener: jest.fn(),
    }
    mockRegistration.installing = mockNewWorker

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: { state: 'activated' },
      },
      configurable: true,
      writable: true,
    })

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    const loadListeners: Function[] = []
    jest.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'load') {
        loadListeners.push(handler)
      }
    })

    jest.resetModules()
    jest.unmock('@/lib/sw-register')
    const mod = await import('@/lib/sw-register')
    mod.registerServiceWorker()

    await loadListeners[0]()

    // Get updatefound handler and trigger it
    const updateFoundHandler = mockRegistration.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'updatefound'
    )?.[1]
    updateFoundHandler()

    // Get statechange handler and trigger it
    const stateChangeHandler = mockNewWorker.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'statechange'
    )?.[1]
    stateChangeHandler()

    expect(consoleSpy).toHaveBeenCalledWith(
      '[SW] New version available. Refresh to update.'
    )

    consoleSpy.mockRestore()
  })

  it('handles registration failure gracefully', async () => {
    mockRegister.mockRejectedValue(new Error('Registration failed'))

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: null,
      },
      configurable: true,
      writable: true,
    })

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

    const loadListeners: Function[] = []
    jest.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'load') {
        loadListeners.push(handler)
      }
    })

    jest.resetModules()
    jest.unmock('@/lib/sw-register')
    const mod = await import('@/lib/sw-register')
    mod.registerServiceWorker()

    await loadListeners[0]()

    expect(consoleSpy).toHaveBeenCalledWith(
      '[SW] Registration failed:',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })
})
