// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Initialize i18n for tests with Spanish locale (default)
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './src/locales/es.json'
import en from './src/locales/en.json'

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
})

// Mock WebSocket client (imported by auth-context)
jest.mock('@/lib/websocket', () => ({
  wsClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(() => jest.fn()),
    onAny: jest.fn(() => jest.fn()),
    connected: false,
  },
}))

// Mock service worker registration (imported by auth-context)
jest.mock('@/lib/sw-register', () => ({
  registerServiceWorker: jest.fn(),
}))

// Mock i18n module import (side-effect import in auth-context)
jest.mock('@/lib/i18n', () => {})
