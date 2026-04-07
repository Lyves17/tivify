import { middleware, config } from '@/middleware'

// Mock NextResponse
const mockNext = jest.fn(() => ({ type: 'next' }))

jest.mock('next/server', () => ({
  NextResponse: {
    next: (...args: unknown[]) => mockNext(...args),
    redirect: jest.fn((url: URL) => ({ type: 'redirect', url })),
  },
}))

function createMockRequest(pathname: string) {
  return {
    nextUrl: {
      pathname,
      clone: () => ({ pathname }),
    },
    url: `http://localhost:3000${pathname}`,
    cookies: {
      get: jest.fn(),
    },
  } as any
}

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('route classification', () => {
    it('passes through public routes', () => {
      const request = createMockRequest('/')
      const result = middleware(request)
      expect(mockNext).toHaveBeenCalled()
      expect(result).toEqual({ type: 'next' })
    })

    it('passes through /channels route', () => {
      const request = createMockRequest('/channels')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })

    it('passes through /vod route', () => {
      const request = createMockRequest('/vod')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })

    it('passes through /series route', () => {
      const request = createMockRequest('/series')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('protected routes', () => {
    it('passes through /admin route (client-side guard handles auth)', () => {
      const request = createMockRequest('/admin')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })

    it('passes through /admin/users sub-route', () => {
      const request = createMockRequest('/admin/users')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })

    it('passes through /profile route', () => {
      const request = createMockRequest('/profile')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })

    it('passes through /favorites route', () => {
      const request = createMockRequest('/favorites')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })

    it('passes through /history route', () => {
      const request = createMockRequest('/history')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })

    it('passes through /settings route', () => {
      const request = createMockRequest('/settings')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('auth routes', () => {
    it('passes through /login route', () => {
      const request = createMockRequest('/login')
      middleware(request)
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('always returns NextResponse.next()', () => {
    const paths = ['/', '/login', '/admin', '/admin/dashboard', '/profile', '/favorites', '/history', '/settings', '/channels', '/vod', '/some-random-path']

    paths.forEach((path) => {
      it(`returns next() for ${path}`, () => {
        const request = createMockRequest(path)
        const result = middleware(request)
        expect(result).toEqual({ type: 'next' })
      })
    })
  })
})

describe('middleware config', () => {
  it('exports a matcher config', () => {
    expect(config).toBeDefined()
    expect(config.matcher).toBeDefined()
    expect(Array.isArray(config.matcher)).toBe(true)
    expect(config.matcher.length).toBeGreaterThan(0)
  })

  it('matcher excludes api routes, static files, and metadata files', () => {
    const pattern = config.matcher[0]
    // The pattern should be a negative lookahead excluding api, _next/static, _next/image, favicon.ico, sitemap.xml, robots.txt
    expect(pattern).toContain('api')
    expect(pattern).toContain('_next/static')
    expect(pattern).toContain('_next/image')
    expect(pattern).toContain('favicon.ico')
    expect(pattern).toContain('sitemap.xml')
    expect(pattern).toContain('robots.txt')
  })
})
