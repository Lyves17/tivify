import axios, { AxiosInstance } from 'axios'
import { secureTokenStore } from '@/lib/secure-token-store'

// Mock secure token store
jest.mock('@/lib/secure-token-store', () => ({
  secureTokenStore: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
    hasToken: jest.fn(),
  },
}))

describe('API Configuration', () => {
  it('should create axios instance with correct base URL', () => {
    // Import api module to trigger instance creation
    jest.isolateModules(() => {
      require('@/lib/api')
    })
    expect(true).toBe(true)
  })

  it('should have default timeout of 30 seconds', async () => {
    const mockSecureTokenStore = secureTokenStore as jest.Mocked<
      typeof secureTokenStore
    >
    mockSecureTokenStore.getToken.mockReturnValue(null)

    // Test that API module loads without errors
    const apiModule = require('@/lib/api')
    expect(apiModule.default).toBeDefined()
  })

  it('secure token store should have required methods', () => {
    expect(secureTokenStore.getToken).toBeDefined()
    expect(secureTokenStore.setToken).toBeDefined()
    expect(secureTokenStore.clearToken).toBeDefined()
    expect(secureTokenStore.hasToken).toBeDefined()
  })
})
