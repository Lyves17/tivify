import { cn, resolveUrl, formatDurationHuman, formatDurationTimer, isValidURL } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('px-2', 'py-1')
    expect(result).toContain('px-2')
    expect(result).toContain('py-1')
  })
  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'visible')
    expect(result).toContain('base')
    expect(result).toContain('visible')
    expect(result).not.toContain('hidden')
  })
  it('merges tailwind conflicts', () => {
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4')
  })
  it('handles empty inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('resolveUrl', () => {
  it('returns absolute http URLs unchanged', () => {
    expect(resolveUrl('http://example.com/stream')).toBe('http://example.com/stream')
  })
  it('returns absolute https URLs unchanged', () => {
    expect(resolveUrl('https://example.com/stream')).toBe('https://example.com/stream')
  })
  it('allows /api/ prefix', () => {
    expect(resolveUrl('/api/channels')).toContain('/api/channels')
  })
  it('allows /media/ prefix', () => {
    expect(resolveUrl('/media/local/1/index.m3u8')).toContain('/media/local/1/index.m3u8')
  })
  it('allows /live/ prefix', () => {
    expect(resolveUrl('/live/stream')).toContain('/live/stream')
  })
  it('allows /movie/ prefix', () => {
    expect(resolveUrl('/movie/123')).toContain('/movie/123')
  })
  it('allows /series/ prefix', () => {
    expect(resolveUrl('/series/456')).toContain('/series/456')
  })
  it('throws for disallowed paths', () => {
    expect(() => resolveUrl('/admin/secret')).toThrow('Invalid URL path')
  })
  it('throws for path traversal', () => {
    expect(() => resolveUrl('/../etc/passwd')).toThrow('Invalid URL path')
  })
})

describe('formatDurationHuman', () => {
  it('formats hours and minutes', () => {
    expect(formatDurationHuman(9000)).toBe('2h 30m')
  })
  it('formats minutes only', () => {
    expect(formatDurationHuman(1800)).toBe('30 min')
  })
  it('formats zero', () => {
    expect(formatDurationHuman(0)).toBe('0 min')
  })
  it('formats 1 hour exactly', () => {
    expect(formatDurationHuman(3600)).toBe('1h 0m')
  })
})

describe('formatDurationTimer', () => {
  it('formats hours:minutes:seconds', () => {
    expect(formatDurationTimer(9045)).toBe('2:30:45')
  })
  it('formats minutes:seconds', () => {
    expect(formatDurationTimer(330)).toBe('5:30')
  })
  it('pads seconds', () => {
    expect(formatDurationTimer(65)).toBe('1:05')
  })
  it('returns 0:00 for zero', () => {
    expect(formatDurationTimer(0)).toBe('0:00')
  })
  it('returns 0:00 for NaN', () => {
    expect(formatDurationTimer(NaN)).toBe('0:00')
  })
})

describe('isValidURL', () => {
  it('returns true for valid URLs', () => {
    expect(isValidURL('https://example.com')).toBe(true)
  })
  it('returns false for invalid strings', () => {
    expect(isValidURL('not a url')).toBe(false)
  })
  it('returns false for empty string', () => {
    expect(isValidURL('')).toBe(false)
  })
})
