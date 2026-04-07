// We need to test the class directly, not the singleton
// Import fresh for each test by resetting modules

let secureTokenStore: typeof import('@/lib/secure-token-store').secureTokenStore

beforeEach(() => {
  jest.resetModules()
  sessionStorage.clear()
})

async function getStore() {
  const mod = await import('@/lib/secure-token-store')
  return mod.secureTokenStore
}

describe('SecureTokenStore', () => {
  it('initially has no token', async () => {
    secureTokenStore = await getStore()
    expect(secureTokenStore.getToken()).toBeNull()
    expect(secureTokenStore.hasToken()).toBe(false)
  })

  it('setToken stores token in memory', async () => {
    secureTokenStore = await getStore()
    secureTokenStore.setToken('my-jwt-token')
    expect(secureTokenStore.getToken()).toBe('my-jwt-token')
    expect(secureTokenStore.hasToken()).toBe(true)
  })

  it('setToken also stores in sessionStorage', async () => {
    secureTokenStore = await getStore()
    secureTokenStore.setToken('my-jwt-token')
    expect(sessionStorage.getItem('_t')).toBe('my-jwt-token')
  })

  it('setToken ignores empty string', async () => {
    secureTokenStore = await getStore()
    secureTokenStore.setToken('')
    expect(secureTokenStore.getToken()).toBeNull()
  })

  it('getToken falls back to sessionStorage', async () => {
    sessionStorage.setItem('_t', 'stored-token')
    secureTokenStore = await getStore()
    // Memory is null, should fallback to sessionStorage
    expect(secureTokenStore.getToken()).toBe('stored-token')
  })

  it('clearToken removes from both memory and sessionStorage', async () => {
    secureTokenStore = await getStore()
    secureTokenStore.setToken('my-jwt-token')
    secureTokenStore.clearToken()
    expect(secureTokenStore.getToken()).toBeNull()
    expect(secureTokenStore.hasToken()).toBe(false)
    expect(sessionStorage.getItem('_t')).toBeNull()
  })

  it('hasToken returns false after clear', async () => {
    secureTokenStore = await getStore()
    secureTokenStore.setToken('token')
    expect(secureTokenStore.hasToken()).toBe(true)
    secureTokenStore.clearToken()
    expect(secureTokenStore.hasToken()).toBe(false)
  })
})
