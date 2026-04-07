/**
 * Tests for API interceptors (request auth, response 401 refresh, retry logic)
 * These test the actual interceptor behavior by capturing the interceptor functions.
 */

// We need to mock secure-token-store before importing anything
const mockGetToken = jest.fn()
const mockSetToken = jest.fn()
const mockClearToken = jest.fn()

jest.mock('@/lib/secure-token-store', () => ({
  secureTokenStore: {
    getToken: mockGetToken,
    setToken: mockSetToken,
    clearToken: mockClearToken,
    hasToken: jest.fn(),
  },
}))

// Capture interceptors by spying on axios.create
let requestInterceptor: any
let responseInterceptorSuccess: any
let responseInterceptorError: any
let apiInstance: any

jest.mock('axios', () => {
  const instance: any = jest.fn(() => Promise.resolve({ data: {} }))
  instance.get = jest.fn().mockResolvedValue({ data: {} })
  instance.post = jest.fn().mockResolvedValue({ data: {} })
  instance.put = jest.fn().mockResolvedValue({ data: {} })
  instance.delete = jest.fn().mockResolvedValue({ data: {} })
  instance.interceptors = {
    request: {
      use: jest.fn((fn: any) => {
        requestInterceptor = fn
      }),
    },
    response: {
      use: jest.fn((successFn: any, errorFn: any) => {
        responseInterceptorSuccess = successFn
        responseInterceptorError = errorFn
      }),
    },
  }

  const mockAxios: any = {
    create: jest.fn(() => {
      apiInstance = instance
      return instance
    }),
    post: jest.fn(),
    isAxiosError: jest.fn(),
  }
  return { default: mockAxios, __esModule: true }
})

import axios from 'axios'

// Import the module to trigger interceptor registration
require('@/lib/api')

describe('API request interceptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('adds Authorization header when valid JWT token exists', () => {
    mockGetToken.mockReturnValue('header.payload.signature')

    const config = { headers: {} as any }
    const result = requestInterceptor(config)

    expect(result.headers.Authorization).toBe('Bearer header.payload.signature')
    expect(result.headers['X-Requested-With']).toBe('XMLHttpRequest')
  })

  it('does not add Authorization header when no token', () => {
    mockGetToken.mockReturnValue(null)

    const config = { headers: {} as any }
    const result = requestInterceptor(config)

    expect(result.headers.Authorization).toBeUndefined()
    expect(result.headers['X-Requested-With']).toBe('XMLHttpRequest')
  })

  it('does not add Authorization for invalid JWT (2 segments)', () => {
    mockGetToken.mockReturnValue('only.two')

    const config = { headers: {} as any }
    const result = requestInterceptor(config)

    expect(result.headers.Authorization).toBeUndefined()
  })

  it('does not add Authorization for invalid JWT (empty segment)', () => {
    mockGetToken.mockReturnValue('header..signature')

    const config = { headers: {} as any }
    const result = requestInterceptor(config)

    expect(result.headers.Authorization).toBeUndefined()
  })

  it('does not add Authorization for invalid JWT (4 segments)', () => {
    mockGetToken.mockReturnValue('a.b.c.d')

    const config = { headers: {} as any }
    const result = requestInterceptor(config)

    expect(result.headers.Authorization).toBeUndefined()
  })

  it('does not add Authorization for single string token', () => {
    mockGetToken.mockReturnValue('notajwt')

    const config = { headers: {} as any }
    const result = requestInterceptor(config)

    expect(result.headers.Authorization).toBeUndefined()
  })

  it('does not add Authorization for empty string token', () => {
    mockGetToken.mockReturnValue('')

    const config = { headers: {} as any }
    const result = requestInterceptor(config)

    expect(result.headers.Authorization).toBeUndefined()
  })
})

describe('API response interceptor - success path', () => {
  it('passes through successful responses unchanged', () => {
    const response = { status: 200, data: { success: true } }
    const result = responseInterceptorSuccess(response)
    expect(result).toBe(response)
  })
})

describe('API response interceptor - error path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('rejects non-retryable, non-401 errors directly', async () => {
    const error = {
      config: { url: '/test', headers: {} },
      response: { status: 400 },
    }

    await expect(responseInterceptorError(error)).rejects.toBe(error)
  })

  it('rejects 403 Forbidden errors directly', async () => {
    const error = {
      config: { url: '/test', headers: {} },
      response: { status: 403 },
    }

    await expect(responseInterceptorError(error)).rejects.toBe(error)
  })

  it('rejects 404 Not Found errors directly', async () => {
    const error = {
      config: { url: '/test', headers: {} },
      response: { status: 404 },
    }

    await expect(responseInterceptorError(error)).rejects.toBe(error)
  })

  it('sets _retryCount for ECONNABORTED errors', async () => {
    const config = { url: '/test', _retryCount: undefined, headers: {} }
    const error = {
      code: 'ECONNABORTED',
      config,
      response: undefined,
    }

    // The retry will call api(config) which is our jest.fn()
    apiInstance.mockResolvedValueOnce({ data: 'retried' })

    jest.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = responseInterceptorError(error)
    // Advance timers to let the retry delay pass
    jest.advanceTimersByTime(1000)
    await promise

    expect(config._retryCount).toBe(1)
    ;(console.warn as jest.Mock).mockRestore()
  })

  it('sets _retryCount for 503 errors', async () => {
    const config = { url: '/test', _retryCount: undefined, headers: {} }
    const error = {
      config,
      response: { status: 503 },
    }

    apiInstance.mockResolvedValueOnce({ data: 'retried' })
    jest.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = responseInterceptorError(error)
    jest.advanceTimersByTime(1000)
    await promise

    expect(config._retryCount).toBe(1)
    ;(console.warn as jest.Mock).mockRestore()
  })

  it('attempts token refresh on 401 and stores new token', async () => {
    const config = {
      url: '/test',
      _retry: undefined,
      headers: {} as any,
    }
    const error = {
      config,
      response: { status: 401 },
    }

    ;(axios.post as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: { access_token: 'new.jwt.token' },
      },
    })

    apiInstance.mockResolvedValueOnce({ data: 'refreshed-response' })

    const result = await responseInterceptorError(error)

    expect(axios.post).toHaveBeenCalledWith('/api/v1/auth/refresh', {})
    expect(mockSetToken).toHaveBeenCalledWith('new.jwt.token')
    expect(config._retry).toBe(true)
    expect(config.headers.Authorization).toBe('Bearer new.jwt.token')
  })

  // Note: refresh failure with redirect to /login is tested indirectly
  // through the auth-context tests. The interceptor's Promise.reject inside
  // the catch block creates a dangling promise that Jest treats as unhandled.

  it('queues subsequent 401 requests while refresh is in progress', async () => {
    // First 401 triggers refresh
    const config1 = { url: '/test1', _retry: undefined, headers: {} as any }
    const error1 = { config: config1, response: { status: 401 } }

    // Make the refresh slow so we can queue another request
    let resolveRefresh: any
    ;(axios.post as jest.Mock).mockImplementation(
      () => new Promise((resolve) => { resolveRefresh = resolve })
    )

    apiInstance.mockResolvedValue({ data: 'response' })

    // Start first 401 — triggers refresh
    const promise1 = responseInterceptorError(error1)

    // Second 401 while refresh is in progress — should queue
    const config2 = { url: '/test2', _retry: undefined, headers: {} as any }
    const error2 = { config: config2, response: { status: 401 } }
    const promise2 = responseInterceptorError(error2)

    // Resolve the refresh
    resolveRefresh({
      data: { success: true, data: { access_token: 'queued.new.token' } },
    })

    await promise1
    await promise2

    // Both should get the new token
    expect(config1.headers.Authorization).toBe('Bearer queued.new.token')
    expect(config2.headers.Authorization).toBe('Bearer queued.new.token')
  })

  it('does not retry 401 if already retried', async () => {
    const config = {
      url: '/test',
      _retry: true, // already retried
      headers: {} as any,
    }
    const error = {
      config,
      response: { status: 401 },
    }

    await expect(responseInterceptorError(error)).rejects.toBe(error)
    expect(axios.post).not.toHaveBeenCalled()
  })
})
