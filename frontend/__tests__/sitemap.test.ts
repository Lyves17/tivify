import sitemap from '@/app/sitemap'

describe('sitemap', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns an array of sitemap entries', async () => {
    const result = await sitemap()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes the root URL', async () => {
    const result = await sitemap()
    const root = result.find((entry) => entry.url.endsWith('/'))
    expect(root).toBeDefined()
    expect(root!.priority).toBe(1)
    expect(root!.changeFrequency).toBe('weekly')
  })

  it('includes /channels route', async () => {
    const result = await sitemap()
    const channels = result.find((entry) => entry.url.includes('/channels'))
    expect(channels).toBeDefined()
    expect(channels!.changeFrequency).toBe('daily')
    expect(channels!.priority).toBe(0.8)
  })

  it('includes /vod route', async () => {
    const result = await sitemap()
    const vod = result.find((entry) => entry.url.includes('/vod'))
    expect(vod).toBeDefined()
    expect(vod!.changeFrequency).toBe('daily')
    expect(vod!.priority).toBe(0.8)
  })

  it('includes /series route', async () => {
    const result = await sitemap()
    const series = result.find((entry) => entry.url.includes('/series'))
    expect(series).toBeDefined()
    expect(series!.changeFrequency).toBe('daily')
    expect(series!.priority).toBe(0.8)
  })

  it('includes /login route', async () => {
    const result = await sitemap()
    const login = result.find((entry) => entry.url.includes('/login'))
    expect(login).toBeDefined()
    expect(login!.changeFrequency).toBe('monthly')
    expect(login!.priority).toBe(0.5)
  })

  it('uses NEXT_PUBLIC_BASE_URL env var when set', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://tivify.example.com'

    // Re-import to pick up new env
    jest.resetModules()
    const { default: freshSitemap } = await import('@/app/sitemap')
    const result = await freshSitemap()

    result.forEach((entry) => {
      expect(entry.url).toContain('https://tivify.example.com')
    })
  })

  it('falls back to https://example.com when env var is not set', async () => {
    delete process.env.NEXT_PUBLIC_BASE_URL

    jest.resetModules()
    const { default: freshSitemap } = await import('@/app/sitemap')
    const result = await freshSitemap()

    result.forEach((entry) => {
      expect(entry.url).toContain('https://example.com')
    })
  })

  it('returns exactly 5 static routes', async () => {
    const result = await sitemap()
    expect(result.length).toBe(5)
  })
})
