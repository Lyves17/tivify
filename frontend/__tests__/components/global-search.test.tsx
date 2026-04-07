import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import i18n from 'i18next'
import GlobalSearch from '@/components/ui/global-search'

jest.mock('@/lib/api')
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />
  },
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, onClick, ...props }: any) => (
    <a {...props} onClick={onClick}>
      {children}
    </a>
  ),
}))

import { userAPI } from '@/lib/api'

const mockSearch = userAPI.search as jest.Mock

const searchResults = {
  channels: [
    { id: 1, name: 'ESPN', logo_url: 'https://example.com/espn.png', channel_number: 1 },
    { id: 2, name: 'BBC', logo_url: null, channel_number: 2 },
  ],
  vods: [
    { id: 10, title: 'Inception', poster_url: 'https://example.com/inception.jpg', year: 2010 },
  ],
  series: [
    { id: 20, title: 'Breaking Bad', poster_url: null, year: 2008 },
  ],
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    i18n.changeLanguage('es')
    mockSearch.mockResolvedValue({
      data: { data: searchResults },
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders search button when closed', () => {
    render(<GlobalSearch />)
    const button = screen.getByTitle('Buscar')
    expect(button).toBeInTheDocument()
  })

  it('opens search input when button is clicked', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar canales/i)).toBeInTheDocument()
    })
  })

  it('closes search when close button is clicked', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar canales/i)).toBeInTheDocument()
    })

    const closeButton = screen.getByLabelText('Cerrar')
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/buscar canales/i)).not.toBeInTheDocument()
    })
  })

  it('performs debounced search on input', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'test' } })

    // Should NOT have called search yet (debounced)
    expect(mockSearch).not.toHaveBeenCalled()

    // Fast-forward past debounce time (500ms)
    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('test')
    })
  })

  it('displays channel results', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'espn' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })
    expect(screen.getByText('BBC')).toBeInTheDocument()
  })

  it('displays VOD results', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'inception' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
    expect(screen.getByText('2010')).toBeInTheDocument()
  })

  it('displays series results', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'breaking' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    expect(screen.getByText('2008')).toBeInTheDocument()
  })

  it('shows no results message', async () => {
    mockSearch.mockResolvedValue({
      data: { data: { channels: [], vods: [], series: [] } },
    })

    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'nonexistent' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(screen.getByText(/sin resultados para/i)).toBeInTheDocument()
    })
  })

  it('does not search for empty/whitespace query', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: '   ' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('closes on escape key', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar canales/i)).toBeInTheDocument()
    })

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/buscar canales/i)).not.toBeInTheDocument()
    })
  })

  it('closes on click outside', async () => {
    const { container } = render(
      <div>
        <div data-testid="outside">Outside</div>
        <GlobalSearch />
      </div>,
    )

    fireEvent.click(screen.getByTitle('Buscar'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar canales/i)).toBeInTheDocument()
    })

    fireEvent.mouseDown(screen.getByTestId('outside'))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/buscar canales/i)).not.toBeInTheDocument()
    })
  })

  it('navigating to item closes search', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'espn' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })

    // Click on a result link
    fireEvent.click(screen.getByText('ESPN'))

    // Search should close
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/buscar canales/i)).not.toBeInTheDocument()
    })
  })

  it('renders correct link hrefs for results', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'test' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(screen.getByText('ESPN')).toBeInTheDocument()
    })

    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/channels/1')
    expect(hrefs).toContain('/channels/2')
    expect(hrefs).toContain('/vod/10')
    expect(hrefs).toContain('/series/20')
  })

  it('shows loading state while searching', async () => {
    mockSearch.mockImplementation(() => new Promise(() => {}))

    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'test' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(screen.getByText(/buscando/i)).toBeInTheDocument()
    })
  })

  it('renders section headers for result types', async () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByTitle('Buscar'))

    const input = screen.getByPlaceholderText(/buscar canales/i)
    fireEvent.change(input, { target: { value: 'test' } })

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(screen.getByText('Canales')).toBeInTheDocument()
    })
    expect(screen.getByText('Peliculas')).toBeInTheDocument()
    expect(screen.getByText('Series')).toBeInTheDocument()
  })
})
