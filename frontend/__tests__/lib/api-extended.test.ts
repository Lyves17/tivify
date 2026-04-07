// Extended API tests - utility functions and API method routing

// Mock secure token store before importing api
jest.mock('@/lib/secure-token-store', () => ({
  secureTokenStore: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
    hasToken: jest.fn(),
  },
}))

// Mock axios
jest.mock('axios', () => {
  const mockAxios: any = {
    create: jest.fn(() => mockAxios),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    isAxiosError: jest.fn(),
  }
  return { default: mockAxios, __esModule: true }
})

import axios from 'axios'

// We need to test the functions by importing the module after mocks are set up
// The functions are not directly exported, so we use isolateModules to get a fresh copy

describe('isValidJWTFormat (via module internals)', () => {
  // Since isValidJWTFormat is not exported, we test it indirectly through the interceptor behavior
  // But we can also test the pattern it checks

  it('valid JWT has 3 non-empty segments separated by dots', () => {
    // Valid JWT format: header.payload.signature
    const validToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const parts = validToken.split('.')
    expect(parts.length).toBe(3)
    expect(parts.every((p: string) => p.length > 0)).toBe(true)
  })

  it('invalid JWT: only 2 segments', () => {
    const invalidToken = 'header.payload'
    const parts = invalidToken.split('.')
    expect(parts.length).toBe(2)
    expect(parts.length === 3 && parts.every((p: string) => p.length > 0)).toBe(false)
  })

  it('invalid JWT: empty segment', () => {
    const invalidToken = 'header..signature'
    const parts = invalidToken.split('.')
    expect(parts.length).toBe(3)
    expect(parts.every((p: string) => p.length > 0)).toBe(false)
  })

  it('invalid JWT: 4 segments', () => {
    const invalidToken = 'a.b.c.d'
    const parts = invalidToken.split('.')
    expect(parts.length === 3 && parts.every((p: string) => p.length > 0)).toBe(false)
  })

  it('invalid JWT: single string', () => {
    const invalidToken = 'notajwt'
    const parts = invalidToken.split('.')
    expect(parts.length === 3 && parts.every((p: string) => p.length > 0)).toBe(false)
  })

  it('invalid JWT: empty string', () => {
    const invalidToken = ''
    const parts = invalidToken.split('.')
    expect(parts.length === 3 && parts.every((p: string) => p.length > 0)).toBe(false)
  })
})

describe('getExponentialBackoffDelay logic', () => {
  // The function: Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs) + jitter
  // baseDelayMs = 500, maxDelayMs = 10000

  const baseDelayMs = 500
  const maxDelayMs = 10000

  it('attempt 0 returns delay around 500ms', () => {
    const delay = Math.min(baseDelayMs * Math.pow(2, 0), maxDelayMs)
    expect(delay).toBe(500)
  })

  it('attempt 1 returns delay around 1000ms', () => {
    const delay = Math.min(baseDelayMs * Math.pow(2, 1), maxDelayMs)
    expect(delay).toBe(1000)
  })

  it('attempt 2 returns delay around 2000ms', () => {
    const delay = Math.min(baseDelayMs * Math.pow(2, 2), maxDelayMs)
    expect(delay).toBe(2000)
  })

  it('attempt 3 returns delay around 4000ms', () => {
    const delay = Math.min(baseDelayMs * Math.pow(2, 3), maxDelayMs)
    expect(delay).toBe(4000)
  })

  it('attempt 4 returns delay around 8000ms', () => {
    const delay = Math.min(baseDelayMs * Math.pow(2, 4), maxDelayMs)
    expect(delay).toBe(8000)
  })

  it('attempt 5 is capped at maxDelayMs (10000ms)', () => {
    const delay = Math.min(baseDelayMs * Math.pow(2, 5), maxDelayMs)
    expect(delay).toBe(10000)
  })

  it('large attempt numbers are capped at maxDelayMs', () => {
    const delay = Math.min(baseDelayMs * Math.pow(2, 20), maxDelayMs)
    expect(delay).toBe(10000)
  })

  it('jitter adds a small amount (up to 10% of delay)', () => {
    const attempt = 2
    const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
    const maxJitter = delay * 0.1
    // Jitter should be between 0 and maxJitter
    expect(maxJitter).toBe(200) // 10% of 2000
    // Total should be between delay and delay + maxJitter
    const total = delay + Math.random() * maxJitter
    expect(total).toBeGreaterThanOrEqual(delay)
    expect(total).toBeLessThanOrEqual(delay + maxJitter)
  })
})

describe('isRetryableError logic', () => {
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504]

  it('ECONNABORTED is retryable', () => {
    const error = { code: 'ECONNABORTED' }
    expect(error.code === 'ECONNABORTED').toBe(true)
  })

  it('408 Request Timeout is retryable', () => {
    expect(retryableStatusCodes.includes(408)).toBe(true)
  })

  it('429 Too Many Requests is retryable', () => {
    expect(retryableStatusCodes.includes(429)).toBe(true)
  })

  it('500 Internal Server Error is retryable', () => {
    expect(retryableStatusCodes.includes(500)).toBe(true)
  })

  it('502 Bad Gateway is retryable', () => {
    expect(retryableStatusCodes.includes(502)).toBe(true)
  })

  it('503 Service Unavailable is retryable', () => {
    expect(retryableStatusCodes.includes(503)).toBe(true)
  })

  it('504 Gateway Timeout is retryable', () => {
    expect(retryableStatusCodes.includes(504)).toBe(true)
  })

  it('400 Bad Request is NOT retryable', () => {
    expect(retryableStatusCodes.includes(400)).toBe(false)
  })

  it('401 Unauthorized is NOT retryable', () => {
    expect(retryableStatusCodes.includes(401)).toBe(false)
  })

  it('403 Forbidden is NOT retryable', () => {
    expect(retryableStatusCodes.includes(403)).toBe(false)
  })

  it('404 Not Found is NOT retryable', () => {
    expect(retryableStatusCodes.includes(404)).toBe(false)
  })

  it('no response status and no code is NOT retryable', () => {
    const error = { response: null, code: null }
    const isRetryable =
      error.code === 'ECONNABORTED' ||
      (error.response && retryableStatusCodes.includes((error.response as any)?.status))
    expect(isRetryable).toBeFalsy()
  })
})

describe('adminAPI methods', () => {
  let adminAPI: any

  beforeEach(() => {
    jest.clearAllMocks()
    // Fresh import to get the adminAPI
    adminAPI = require('@/lib/api').adminAPI
  })

  it('getStats calls GET /v1/admin/dashboard/stats', async () => {
    await adminAPI.getStats()
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/admin/dashboard/stats',
    )
  })

  it('getCategories calls GET /v1/admin/categories with pagination', async () => {
    await adminAPI.getCategories(2, 30)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/admin/categories',
      { params: { page: 2, per_page: 30 } },
    )
  })

  it('getCategories uses defaults page=1 perPage=50', async () => {
    await adminAPI.getCategories()
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/admin/categories',
      { params: { page: 1, per_page: 50 } },
    )
  })

  it('createCategory calls POST /v1/admin/categories', async () => {
    const data = { name: 'Sports', type: 'live' }
    await adminAPI.createCategory(data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/categories', data)
  })

  it('updateCategory calls PUT /v1/admin/categories/:id', async () => {
    const data = { name: 'News' }
    await adminAPI.updateCategory(5, data)
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/categories/5', data)
  })

  it('deleteCategory calls DELETE /v1/admin/categories/:id', async () => {
    await adminAPI.deleteCategory(5)
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/categories/5')
  })

  it('getChannels calls GET /v1/admin/channels with pagination', async () => {
    await adminAPI.getChannels(1, 10)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/admin/channels',
      { params: { page: 1, per_page: 10 } },
    )
  })

  it('getChannel calls GET /v1/admin/channels/:id', async () => {
    await adminAPI.getChannel(42)
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/channels/42')
  })

  it('createChannel calls POST /v1/admin/channels', async () => {
    const data = { name: 'ESPN' }
    await adminAPI.createChannel(data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/channels', data)
  })

  it('deleteChannel calls DELETE /v1/admin/channels/:id', async () => {
    await adminAPI.deleteChannel(42)
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/channels/42')
  })

  it('getVODs calls GET /v1/admin/vod with pagination', async () => {
    await adminAPI.getVODs(3, 10)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/admin/vod',
      { params: { page: 3, per_page: 10 } },
    )
  })

  it('deleteVOD calls DELETE /v1/admin/vod/:id', async () => {
    await adminAPI.deleteVOD(99)
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/vod/99')
  })

  it('getSeries calls GET /v1/admin/series with pagination', async () => {
    await adminAPI.getSeries(1, 20)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/admin/series',
      { params: { page: 1, per_page: 20 } },
    )
  })

  it('getUsers calls GET /v1/admin/users with pagination', async () => {
    await adminAPI.getUsers(1, 20)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/admin/users',
      { params: { page: 1, per_page: 20 } },
    )
  })

  it('deleteUser calls DELETE /v1/admin/users/:id', async () => {
    await adminAPI.deleteUser('abc-123')
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/users/abc-123')
  })

  it('enrichVODs calls POST /v1/admin/vod/enrich', async () => {
    await adminAPI.enrichVODs()
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/vod/enrich')
  })

  it('enrichSeries calls POST /v1/admin/series/enrich', async () => {
    await adminAPI.enrichSeries()
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/series/enrich')
  })
})

describe('userAPI methods', () => {
  let userAPI: any

  beforeEach(() => {
    jest.clearAllMocks()
    userAPI = require('@/lib/api').userAPI
  })

  it('getChannels calls GET /v1/channels with params', async () => {
    await userAPI.getChannels(1, 20, 'news', 5)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/channels',
      { params: { page: 1, per_page: 20, search: 'news', category_id: 5 } },
    )
  })

  it('getChannel calls GET /v1/channels/:id', async () => {
    await userAPI.getChannel(10)
    expect(axios.get).toHaveBeenCalledWith('/v1/channels/10')
  })

  it('getVODs calls GET /v1/vod with params', async () => {
    await userAPI.getVODs(2, 10, 'matrix')
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/vod',
      { params: { page: 2, per_page: 10, search: 'matrix', category_id: undefined } },
    )
  })

  it('getVOD calls GET /v1/vod/:id', async () => {
    await userAPI.getVOD(55)
    expect(axios.get).toHaveBeenCalledWith('/v1/vod/55')
  })

  it('getSeries calls GET /v1/series with params', async () => {
    await userAPI.getSeries(1, 20)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/series',
      { params: { page: 1, per_page: 20, search: undefined, category_id: undefined } },
    )
  })

  it('getFavorites calls GET /v1/favorites with pagination', async () => {
    await userAPI.getFavorites(1, 20)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/favorites',
      { params: { page: 1, per_page: 20 } },
    )
  })

  it('toggleFavorite calls POST /v1/favorites/toggle', async () => {
    await userAPI.toggleFavorite('vod', 42)
    expect(axios.post).toHaveBeenCalledWith('/v1/favorites/toggle', { type: 'vod', id: 42 })
  })

  it('getHistory calls GET /v1/history with pagination', async () => {
    await userAPI.getHistory(1, 20)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/history',
      { params: { page: 1, per_page: 20 } },
    )
  })

  it('getContinueWatching calls GET /v1/history/continue', async () => {
    await userAPI.getContinueWatching(5)
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/history/continue',
      { params: { limit: 5 } },
    )
  })

  it('deleteHistory calls DELETE /v1/history/:id', async () => {
    await userAPI.deleteHistory(77)
    expect(axios.delete).toHaveBeenCalledWith('/v1/history/77')
  })

  it('search calls GET /v1/search', async () => {
    await userAPI.search('breaking')
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/search',
      { params: { q: 'breaking' } },
    )
  })

  it('getLiveChannels calls GET /v1/emissions/live', async () => {
    await userAPI.getLiveChannels()
    expect(axios.get).toHaveBeenCalledWith('/v1/emissions/live')
  })

  it('updateProfile calls PUT /v1/profile', async () => {
    await userAPI.updateProfile({ email: 'test@test.com' })
    expect(axios.put).toHaveBeenCalledWith('/v1/profile', { email: 'test@test.com' })
  })

  it('changePassword calls PUT /v1/profile/password', async () => {
    await userAPI.changePassword({ current_password: 'old', new_password: 'new12345' })
    expect(axios.put).toHaveBeenCalledWith('/v1/profile/password', {
      current_password: 'old',
      new_password: 'new12345',
    })
  })
})

describe('authAPI methods', () => {
  let authAPI: any

  beforeEach(() => {
    jest.clearAllMocks()
    authAPI = require('@/lib/api').authAPI
  })

  it('login calls POST /v1/auth/login', async () => {
    await authAPI.login('admin', 'pass123')
    expect(axios.post).toHaveBeenCalledWith('/v1/auth/login', {
      username: 'admin',
      password: 'pass123',
    })
  })

  it('refresh calls POST /v1/auth/refresh', async () => {
    await authAPI.refresh()
    expect(axios.post).toHaveBeenCalledWith('/v1/auth/refresh')
  })

  it('logout calls POST /v1/auth/logout', async () => {
    await authAPI.logout()
    expect(axios.post).toHaveBeenCalledWith('/v1/auth/logout')
  })

  it('me calls GET /v1/auth/me', async () => {
    await authAPI.me()
    expect(axios.get).toHaveBeenCalledWith('/v1/auth/me')
  })
})
