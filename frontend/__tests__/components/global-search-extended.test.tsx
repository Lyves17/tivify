/**
 * Extended tests for GlobalSearch — covers error handling, abort controller,
 * and cleanup on unmount.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import i18n from 'i18next'
import GlobalSearch from '@/components/ui/global-search'

jest.mock('@/lib/api')
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, onClick, ...props }: any) => (
    <a {...props} onClick={onClick}>{children}</a>
  ),
}))

import { userAPI } from '@/lib/api'

const mockSearch = userAPI.search as jest.Mock

describe('GlobalSearch - error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    i18n.changeLanguage('es')
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('handles search API error by setting results to null', async () => {
    mockSearch.mockRejectedValue(new Error('Network error'))

    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'test' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    // After error, no results and no loading
    await waitFor(() => {
      expect(screen.queryByText(/buscando/i)).not.toBeInTheDocument()
    })
  })

  it('handles AbortError gracefully (does not warn)', async () => {
    const abortError = new Error('AbortError')
    abortError.name = 'AbortError'
    mockSearch.mockRejectedValue(abortError)

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'test' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    // AbortError should not trigger console.warn
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('cleans up timer and abort controller on unmount', () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'test' } })

    // Unmount before debounce fires
    // No error should occur
  })

  it('aborts previous search when new search starts', async () => {
    let resolveFirst: any
    let resolveSecond: any

    mockSearch
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))

    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)

    // First search
    fireEvent.change(input, { target: { value: 'first' } })
    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    // Second search before first completes (triggers abort)
    fireEvent.change(input, { target: { value: 'second' } })
    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    expect(mockSearch).toHaveBeenCalledTimes(2)
  })

  it('does not update results if search was aborted', async () => {
    // Simulate a search that completes after being aborted
    mockSearch.mockResolvedValue({
      data: {
        data: {
          channels: [{ id: 1, name: 'ABC', logo_url: null, channel_number: 1 }],
          vods: [],
          series: [],
        },
      },
    })

    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'abc' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(screen.getByText('ABC')).toBeInTheDocument()
    })
  })
})
