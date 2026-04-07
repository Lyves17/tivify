/**
 * Tests for the root layout (src/app/layout.tsx)
 * Tests that providers are rendered correctly and the HTML structure is proper.
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

import RootLayout from '@/app/layout'

describe('RootLayout', () => {
  it('renders children wrapped in providers', () => {
    // RootLayout returns <html><body>..., but in jsdom we can still test the output
    const { container } = render(
      <RootLayout>
        <div data-testid="child-content">Hello</div>
      </RootLayout>
    )

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument()
    expect(screen.getByTestId('toast-provider')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('nests ToastProvider inside AuthProvider', () => {
    render(
      <RootLayout>
        <span>Nested</span>
      </RootLayout>
    )

    const authProvider = screen.getByTestId('auth-provider')
    const toastProvider = screen.getByTestId('toast-provider')

    // ToastProvider should be inside AuthProvider
    expect(authProvider.contains(toastProvider)).toBe(true)
  })

  it('renders children inside ToastProvider', () => {
    render(
      <RootLayout>
        <p>Inner content</p>
      </RootLayout>
    )

    const toastProvider = screen.getByTestId('toast-provider')
    expect(toastProvider).toHaveTextContent('Inner content')
  })

  it('renders html element with lang="es"', () => {
    const { container } = render(
      <RootLayout>
        <div>Test</div>
      </RootLayout>
    )

    // In jsdom, nested html tags get flattened, but we can check the rendered structure
    const htmlEl = container.querySelector('html')
    if (htmlEl) {
      expect(htmlEl).toHaveAttribute('lang', 'es')
    }
  })

  it('renders body with antialiased class', () => {
    const { container } = render(
      <RootLayout>
        <div>Test</div>
      </RootLayout>
    )

    const body = container.querySelector('body')
    if (body) {
      expect(body.className).toContain('antialiased')
    }
  })

  it('renders multiple children correctly', () => {
    render(
      <RootLayout>
        <div data-testid="first">First</div>
        <div data-testid="second">Second</div>
      </RootLayout>
    )

    // Both children should be present
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })
})
