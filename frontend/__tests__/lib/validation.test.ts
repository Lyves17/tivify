import {
  isValidURL,
  isValidEmail,
  validatePassword,
  sanitizeText,
  isValidText,
  validateChannelName,
  validateCategoryName,
  validateVODTitle,
  validateDescription,
  validateStreamURL,
  validateUsername,
} from '@/lib/validation'

describe('isValidURL', () => {
  it('returns true for valid http URL', () => {
    expect(isValidURL('http://example.com')).toBe(true)
  })
  it('returns true for valid https URL', () => {
    expect(isValidURL('https://example.com/path?q=1')).toBe(true)
  })
  it('returns false for plain text', () => {
    expect(isValidURL('not-a-url')).toBe(false)
  })
  it('returns false for empty string', () => {
    expect(isValidURL('')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('returns true for valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })
  it('returns true for email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true)
  })
  it('returns false for missing @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })
  it('returns false for missing domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })
  it('returns false for spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false)
  })
  it('returns false for empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})

describe('validatePassword', () => {
  it('valid password passes all checks', () => {
    const result = validatePassword('MyPass123')
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
  it('short password fails', () => {
    const result = validatePassword('Ab1')
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
  it('missing uppercase fails', () => {
    const result = validatePassword('mypass123')
    expect(result.isValid).toBe(false)
  })
  it('missing lowercase fails', () => {
    const result = validatePassword('MYPASS123')
    expect(result.isValid).toBe(false)
  })
  it('missing number fails', () => {
    const result = validatePassword('MyPassword')
    expect(result.isValid).toBe(false)
  })
  it('empty string fails with multiple errors', () => {
    const result = validatePassword('')
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBe(4)
  })
})

describe('sanitizeText', () => {
  it('removes HTML tags', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold')
  })
  it('removes script tags', () => {
    expect(sanitizeText('<script>alert("xss")</script>hello')).toBe('alert("xss")hello')
  })
  it('decodes HTML entities', () => {
    expect(sanitizeText('&amp; &lt; &gt; &quot; &#039;')).toBe("& < > \" '")
  })
  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
  })
  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('')
  })
})

describe('isValidText', () => {
  it('returns true for valid text', () => {
    expect(isValidText('hello', 1, 100)).toBe(true)
  })
  it('returns false for too short', () => {
    expect(isValidText('', 1, 100)).toBe(false)
  })
  it('returns false for too long', () => {
    expect(isValidText('a'.repeat(101), 1, 100)).toBe(false)
  })
  it('uses default min=1 max=1000', () => {
    expect(isValidText('test')).toBe(true)
  })
  it('allows empty when minLength=0', () => {
    expect(isValidText('', 0, 100)).toBe(true)
  })
})

describe('validateChannelName', () => {
  it('valid name passes', () => {
    expect(validateChannelName('My Channel').isValid).toBe(true)
  })
  it('empty name fails', () => {
    const result = validateChannelName('')
    expect(result.isValid).toBe(false)
    expect(result.error).toBeDefined()
  })
  it('too long name fails', () => {
    expect(validateChannelName('a'.repeat(101)).isValid).toBe(false)
  })
})

describe('validateCategoryName', () => {
  it('valid name passes', () => {
    expect(validateCategoryName('Sports').isValid).toBe(true)
  })
  it('empty name fails', () => {
    expect(validateCategoryName('').isValid).toBe(false)
  })
})

describe('validateVODTitle', () => {
  it('valid title passes', () => {
    expect(validateVODTitle('My Movie').isValid).toBe(true)
  })
  it('empty title fails', () => {
    expect(validateVODTitle('').isValid).toBe(false)
  })
  it('too long title fails', () => {
    expect(validateVODTitle('a'.repeat(256)).isValid).toBe(false)
  })
})

describe('validateDescription', () => {
  it('valid description passes', () => {
    expect(validateDescription('A great movie').isValid).toBe(true)
  })
  it('empty description passes (min=0)', () => {
    expect(validateDescription('').isValid).toBe(true)
  })
  it('too long description fails', () => {
    expect(validateDescription('a'.repeat(5001)).isValid).toBe(false)
  })
})

describe('validateStreamURL', () => {
  it('valid http URL passes', () => {
    expect(validateStreamURL('http://stream.example.com/live.m3u8').isValid).toBe(true)
  })
  it('valid https URL passes', () => {
    expect(validateStreamURL('https://stream.example.com/live.m3u8').isValid).toBe(true)
  })
  it('invalid URL fails', () => {
    expect(validateStreamURL('not-a-url').isValid).toBe(false)
  })
  it('ftp URL fails', () => {
    expect(validateStreamURL('ftp://files.example.com/video.mp4').isValid).toBe(false)
  })
})

describe('validateUsername', () => {
  it('valid username passes', () => {
    expect(validateUsername('john_doe').isValid).toBe(true)
  })
  it('alphanumeric with hyphens passes', () => {
    expect(validateUsername('user-123').isValid).toBe(true)
  })
  it('too short fails', () => {
    expect(validateUsername('ab').isValid).toBe(false)
  })
  it('too long fails', () => {
    expect(validateUsername('a'.repeat(33)).isValid).toBe(false)
  })
  it('special characters fail', () => {
    expect(validateUsername('user@name').isValid).toBe(false)
  })
  it('spaces fail', () => {
    expect(validateUsername('user name').isValid).toBe(false)
  })
})
