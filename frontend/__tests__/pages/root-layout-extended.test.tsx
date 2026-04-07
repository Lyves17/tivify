/**
 * Extended tests for RootLayout (src/app/layout.tsx)
 * Covers: metadata export, multiple renders, provider nesting order
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock AuthProvider
jest.mock('@/context/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}))

// Mock ToastProvider
jest.mock('@/context/toast-context', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="toast-provider">{children}</div>
  ),
}))

import RootLayout, { metadata } from '@/app/layout'

describe('RootLayout - extended', () => {
  it('exports metadata with correct title default', () => {
    expect(metadata).toBeDefined()
    expect((metadata.title as any).default).toBe('TIVIFY')
  })

  it('exports metadata with correct title template', () => {
    expect((metadata.title as any).template).toBe('%s | TIVIFY')
  })

  it('exports metadata with correct description', () => {
    expect(metadata.description).toContain('streaming IPTV')
  })

  it('exports metadata with keywords array', () => {
    expect(metadata.keywords).toEqual(
      expect.arrayContaining(['IPTV', 'streaming'])
    )
  })

  it('exports metadata with manifest path', () => {
    expect(metadata.manifest).toBe('/site.webmanifest')
  })

  it('exports metadata with icons config', () => {
    expect(metadata.icons).toBeDefined()
  })

  it('exports metadata with themeColor', () => {
    expect(metadata.themeColor).toBe('#4f46e5')
  })

  it('exports metadata with robots config', () => {
    expect(metadata.robots).toBeDefined()
    expect((metadata.robots as any).index).toBe(true)
    expect((metadata.robots as any).follow).toBe(true)
  })

  it('exports metadata with openGraph config', () => {
    expect(metadata.openGraph).toBeDefined()
    expect((metadata.openGraph as any).title).toBe('TIVIFY')
    expect((metadata.openGraph as any).type).toBe('website')
    expect((metadata.openGraph as any).locale).toBe('es_ES')
  })

  it('exports metadata with twitter card config', () => {
    expect(metadata.twitter).toBeDefined()
    expect((metadata.twitter as any).card).toBe('summary_large_image')
  })

  it('exports metadata with alternates canonical', () => {
    expect(metadata.alternates).toBeDefined()
    expect((metadata.alternates as any).canonical).toBe('/')
  })

  it('renders empty children gracefully', () => {
    const { container } = render(
      <RootLayout>
        <></>
      </RootLayout>
    )
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument()
    expect(screen.getByTestId('toast-provider')).toBeInTheDocument()
  })

  it('renders complex nested children correctly', () => {
    render(
      <RootLayout>
        <div data-testid="outer">
          <div data-testid="inner">
            <span>Deep nested content</span>
          </div>
        </div>
      </RootLayout>
    )
    expect(screen.getByTestId('outer')).toBeInTheDocument()
    expect(screen.getByTestId('inner')).toBeInTheDocument()
    expect(screen.getByText('Deep nested content')).toBeInTheDocument()
  })

  it('renders ToastProvider inside AuthProvider (correct nesting order)', () => {
    render(
      <RootLayout>
        <span>Test</span>
      </RootLayout>
    )
    const authProvider = screen.getByTestId('auth-provider')
    const toastProvider = screen.getByTestId('toast-provider')
    // Toast must be inside Auth
    expect(authProvider.contains(toastProvider)).toBe(true)
    // Auth must NOT be inside Toast
    expect(toastProvider.contains(authProvider)).toBe(false)
  })
})
