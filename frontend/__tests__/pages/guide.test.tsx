import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import i18n from 'i18next'
import GuidePage from '@/app/(user)/guide/page'

jest.mock('@/lib/api')
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />
  },
}))
jest.mock('@/components/ui/loading-spinner', () => {
  return function MockLoadingSpinner({ text }: { text?: string }) {
    return <div data-testid="loading-spinner">{text || 'Loading...'}</div>
  }
})

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}
jest.mock('@/context/toast-context', () => ({
  useToast: () => mockToast,
}))

import { userAPI } from '@/lib/api'

const mockGetChannels = userAPI.getChannels as jest.Mock
const mockGetEPG = userAPI.getEPG as jest.Mock

const sampleChannels = [
  { id: 1, name: 'ESPN', logo_url: 'https://example.com/espn.png' },
  { id: 2, name: 'HBO', logo_url: null },
]

const sampleEPGEntries = [
  {
    id: 1,
    title: 'Noticias de la Manana',
    start_time: '2026-03-14T08:00:00Z',
    end_time: '2026-03-14T09:00:00Z',
    category: 'Noticias',
    description: 'Las noticias del dia.',
  },
  {
    id: 2,
    title: 'Deportes en Vivo',
    start_time: '2026-03-14T09:00:00Z',
    end_time: '2026-03-14T11:00:00Z',
    category: 'Deportes',
    description: null,
  },
]

/**
 * Helper: render and wait for channels to fully load.
 * The GuidePage fetchChannels depends on selectedChannelId, causing it to be
 * called twice. We must flush all microtask queues to let React process both
 * rounds of state updates.
 */
async function renderAndWaitForLoad(epgData: any[] = []) {
  mockGetChannels.mockResolvedValue({
    data: { data: sampleChannels, meta: { pages: 1 } },
  })
  mockGetEPG.mockResolvedValue({ data: { data: epgData } })

  await act(async () => {
    render(<GuidePage />)
  })

  // Flush remaining microtask-driven state updates (second fetchChannels + fetchEPG)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
}

describe('GuidePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    i18n.changeLanguage('es')
    mockGetEPG.mockResolvedValue({ data: { data: [] } })
  })

  it('renders loading state initially', () => {
    mockGetChannels.mockImplementation(() => new Promise(() => {}))
    render(<GuidePage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders page title after loading', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Guia TV')).toBeInTheDocument()
  })

  it('renders channel list', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('ESPN')).toBeInTheDocument()
    expect(screen.getByText('HBO')).toBeInTheDocument()
  })

  it('renders channel logo when available', async () => {
    await renderAndWaitForLoad()
    const img = screen.getByAltText('ESPN')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/espn.png')
  })

  it('renders date navigation buttons', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Ayer')).toBeInTheDocument()
    expect(screen.getByText('Hoy')).toBeInTheDocument()
    expect(screen.getByText('Manana')).toBeInTheDocument()
  })

  it('renders EPG entries when channel is selected', async () => {
    await renderAndWaitForLoad(sampleEPGEntries)
    expect(screen.getByText('Noticias de la Manana')).toBeInTheDocument()
    expect(screen.getByText('Deportes en Vivo')).toBeInTheDocument()
  })

  it('renders EPG entry categories', async () => {
    await renderAndWaitForLoad(sampleEPGEntries)
    expect(screen.getByText('Noticias')).toBeInTheDocument()
    expect(screen.getByText('Deportes')).toBeInTheDocument()
  })

  it('renders EPG entry descriptions', async () => {
    await renderAndWaitForLoad(sampleEPGEntries)
    expect(screen.getByText('Las noticias del dia.')).toBeInTheDocument()
  })

  it('shows no schedule message when EPG is empty', async () => {
    await renderAndWaitForLoad([])
    expect(screen.getByText(/no hay programacion disponible/i)).toBeInTheDocument()
  })

  it('shows no channels message when channel list is empty', async () => {
    mockGetChannels.mockResolvedValue({
      data: { data: [], meta: { pages: 1 } },
    })
    mockGetEPG.mockResolvedValue({ data: { data: [] } })

    await act(async () => {
      render(<GuidePage />)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByText(/no hay canales disponibles/i)).toBeInTheDocument()
  })

  it('changes selected channel on click', async () => {
    await renderAndWaitForLoad()

    const epgCallsBefore = mockGetEPG.mock.calls.length

    await act(async () => {
      fireEvent.click(screen.getByText('HBO'))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockGetEPG.mock.calls.length).toBeGreaterThan(epgCallsBefore)
  })

  it('shows Programacion header with selected channel name', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Programacion')).toBeInTheDocument()
    expect(screen.getByText(/- ESPN/)).toBeInTheDocument()
  })

  it('renders Canales section header', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Canales')).toBeInTheDocument()
  })

  it('shows error toast when loading channels fails', async () => {
    mockGetChannels.mockRejectedValue(new Error('Network error'))

    await act(async () => {
      render(<GuidePage />)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockToast.error).toHaveBeenCalledWith('Error al cargar canales')
  })

  it('shows error toast when loading EPG fails', async () => {
    mockGetChannels.mockResolvedValue({
      data: { data: sampleChannels, meta: { pages: 1 } },
    })
    mockGetEPG.mockRejectedValue(new Error('Network error'))

    await act(async () => {
      render(<GuidePage />)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockToast.error).toHaveBeenCalledWith('Error al cargar programacion')
  })

  it('renders date input', async () => {
    await renderAndWaitForLoad()
    const dateInput = document.querySelector('input[type="date"]')
    expect(dateInput).toBeInTheDocument()
  })

  it('navigates to next day when clicking next day button', async () => {
    await renderAndWaitForLoad()

    const epgCallsBefore = mockGetEPG.mock.calls.length

    await act(async () => {
      fireEvent.click(screen.getByTitle('Dia siguiente'))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockGetEPG.mock.calls.length).toBeGreaterThan(epgCallsBefore)
  })

  it('navigates to previous day when clicking previous day button', async () => {
    await renderAndWaitForLoad()

    const epgCallsBefore = mockGetEPG.mock.calls.length

    await act(async () => {
      fireEvent.click(screen.getByTitle('Dia anterior'))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockGetEPG.mock.calls.length).toBeGreaterThan(epgCallsBefore)
  })

  // --- Additional coverage tests for uncovered lines ---

  it('clicks Yesterday button to set selectedDate (lines 124-132)', async () => {
    await renderAndWaitForLoad()

    const epgCallsBefore = mockGetEPG.mock.calls.length

    await act(async () => {
      fireEvent.click(screen.getByText('Ayer'))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockGetEPG.mock.calls.length).toBeGreaterThan(epgCallsBefore)
  })

  it('clicks Today button to set selectedDate (lines 133-140)', async () => {
    await renderAndWaitForLoad()

    // First navigate away from today
    await act(async () => {
      fireEvent.click(screen.getByTitle('Dia siguiente'))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const epgCallsBefore = mockGetEPG.mock.calls.length

    // Then click Today
    await act(async () => {
      fireEvent.click(screen.getByText('Hoy'))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockGetEPG.mock.calls.length).toBeGreaterThan(epgCallsBefore)
  })

  it('clicks Tomorrow button to set selectedDate (lines 141-150)', async () => {
    await renderAndWaitForLoad()

    const epgCallsBefore = mockGetEPG.mock.calls.length

    await act(async () => {
      fireEvent.click(screen.getByText('Manana'))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockGetEPG.mock.calls.length).toBeGreaterThan(epgCallsBefore)
  })

  it('changes date via date input (line 165)', async () => {
    await renderAndWaitForLoad()

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput).toBeTruthy()

    const epgCallsBefore = mockGetEPG.mock.calls.length

    await act(async () => {
      fireEvent.change(dateInput, { target: { value: '2026-04-01' } })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockGetEPG.mock.calls.length).toBeGreaterThan(epgCallsBefore)
  })

  it('highlights now-playing EPG entries', async () => {
    // Create EPG entries that span the current time
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 60 * 1000) // 30 min ago
    const end = new Date(now.getTime() + 30 * 60 * 1000)   // 30 min from now

    const liveEntry = {
      id: 10,
      title: 'Live Show Now',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      category: 'Entertainment',
      description: 'A live show happening now.',
    }

    await renderAndWaitForLoad([liveEntry])

    expect(screen.getByText('Live Show Now')).toBeInTheDocument()
    // The "EN VIVO" badge should appear for now-playing entries
    expect(screen.getByText('EN VIVO')).toBeInTheDocument()
  })
})
