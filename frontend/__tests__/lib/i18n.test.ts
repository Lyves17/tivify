/**
 * Tests for i18n configuration module.
 * jest.setup.js mocks @/lib/i18n as an empty object, so we unmock it
 * and test the actual initialization with mocked dependencies.
 */

// Unmock to test the real module
jest.unmock('@/lib/i18n')

// Mock i18next-browser-languagedetector
jest.mock('i18next-browser-languagedetector', () => {
  return {
    __esModule: true,
    default: {
      type: '3rdParty',
      init: jest.fn(),
      detect: jest.fn(() => 'es'),
      cacheUserLanguage: jest.fn(),
    },
  }
})

describe('i18n configuration', () => {
  it('exports a configured i18n instance', () => {
    // Import the actual module (not the mock from jest.setup.js)
    jest.isolateModules(() => {
      const i18n = require('@/lib/i18n').default
      expect(i18n).toBeDefined()
      // i18n should have been initialized
      expect(i18n.isInitialized).toBe(true)
    })
  })

  it('has Spanish as fallback language', () => {
    jest.isolateModules(() => {
      const i18n = require('@/lib/i18n').default
      expect(i18n.options.fallbackLng).toContain('es')
    })
  })

  it('has both es and en resources loaded', () => {
    jest.isolateModules(() => {
      const i18n = require('@/lib/i18n').default
      expect(i18n.hasResourceBundle('es', 'translation')).toBe(true)
      expect(i18n.hasResourceBundle('en', 'translation')).toBe(true)
    })
  })

  it('interpolation escapeValue is false (React handles escaping)', () => {
    jest.isolateModules(() => {
      const i18n = require('@/lib/i18n').default
      expect(i18n.options.interpolation?.escapeValue).toBe(false)
    })
  })

  it('can translate known keys in Spanish', () => {
    jest.isolateModules(() => {
      const i18n = require('@/lib/i18n').default
      // Force Spanish
      i18n.changeLanguage('es')
      expect(i18n.t('app.name')).toBe('TIVIFY')
      expect(i18n.t('auth.login')).toBe('Iniciar sesion')
      expect(i18n.t('nav.home')).toBe('Inicio')
    })
  })

  it('can translate known keys in English', () => {
    jest.isolateModules(() => {
      const i18n = require('@/lib/i18n').default
      i18n.changeLanguage('en')
      // Verify English translations exist
      const appName = i18n.t('app.name')
      expect(appName).toBeDefined()
      expect(typeof appName).toBe('string')
    })
  })

  it('detection config uses localStorage and navigator', () => {
    jest.isolateModules(() => {
      const i18n = require('@/lib/i18n').default
      const detection = i18n.options.detection
      expect(detection?.order).toEqual(['localStorage', 'navigator'])
      expect(detection?.lookupLocalStorage).toBe('tivify_lang')
      expect(detection?.caches).toEqual(['localStorage'])
    })
  })
})
