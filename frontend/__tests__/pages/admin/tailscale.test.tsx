import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TailscalePage from '@/app/admin/tailscale/page'

jest.mock('@/lib/api')

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}
jest.mock('@/context/toast-context', () => ({
  useToast: () => mockToast,
}))

import { adminAPI } from '@/lib/api'

const mockGetTailscaleStatus = adminAPI.getTailscaleStatus as jest.Mock
const mockStartTailscale = adminAPI.startTailscale as jest.Mock
const mockStopTailscale = adminAPI.stopTailscale as jest.Mock
const mockRestartTailscale = adminAPI.restartTailscale as jest.Mock

const runningStatus = {
  container: 'tivify-tailscale',
  status: 'running',
  running: true,
  started_at: '2026-03-10T12:00:00Z',
}

const stoppedStatus = {
  container: 'tivify-tailscale',
  status: 'exited',
  running: false,
}

const notFoundStatus = {
  container: 'tivify-tailscale',
  status: 'not_found',
  running: false,
}

describe('TailscalePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders page title', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: runningStatus } })
    render(<TailscalePage />)
    expect(screen.getByText('Tailscale VPN')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockGetTailscaleStatus.mockImplementation(() => new Promise(() => {}))
    render(<TailscalePage />)
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  it('shows running status', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: runningStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('En ejecucion')).toBeInTheDocument()
    })
  })

  it('shows stopped status', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: stoppedStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('Detenido')).toBeInTheDocument()
    })
  })

  it('shows not found status', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: notFoundStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('No encontrado')).toBeInTheDocument()
    })
  })

  it('renders action buttons', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: runningStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('Arrancar')).toBeInTheDocument()
    })
    expect(screen.getByText('Detener')).toBeInTheDocument()
    expect(screen.getByText('Reiniciar')).toBeInTheDocument()
    expect(screen.getByText('Refrescar')).toBeInTheDocument()
  })

  it('disables start button when already running', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: runningStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('En ejecucion')).toBeInTheDocument()
    })
    const startBtn = screen.getByText('Arrancar').closest('button')!
    expect(startBtn).toBeDisabled()
  })

  it('disables stop/restart buttons when not running', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: stoppedStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('Detenido')).toBeInTheDocument()
    })
    expect(screen.getByText('Detener').closest('button')).toBeDisabled()
    expect(screen.getByText('Reiniciar').closest('button')).toBeDisabled()
  })

  it('calls startTailscale on start button click', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: stoppedStatus } })
    mockStartTailscale.mockResolvedValue({ data: { data: { message: 'Started' } } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('Detenido')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Arrancar').closest('button')!)
    await waitFor(() => {
      expect(mockStartTailscale).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Started')
    })
  })

  it('calls stopTailscale on stop button click', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: runningStatus } })
    mockStopTailscale.mockResolvedValue({ data: { data: { message: 'Stopped' } } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('En ejecucion')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Detener').closest('button')!)
    await waitFor(() => {
      expect(mockStopTailscale).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Stopped')
    })
  })

  it('calls restartTailscale on restart button click', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: runningStatus } })
    mockRestartTailscale.mockResolvedValue({ data: { data: { message: 'Restarted' } } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('En ejecucion')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Reiniciar').closest('button')!)
    await waitFor(() => {
      expect(mockRestartTailscale).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Restarted')
    })
  })

  it('shows error toast when action fails', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: stoppedStatus } })
    mockStartTailscale.mockRejectedValue(new Error('fail'))
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('Detenido')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Arrancar').closest('button')!)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al arrancar Tailscale')
    })
  })

  it('handles null status on fetch error', async () => {
    mockGetTailscaleStatus.mockRejectedValue(new Error('Network error'))
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('Desconocido')).toBeInTheDocument()
    })
  })

  it('renders about section', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: runningStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('Acerca de Tailscale')).toBeInTheDocument()
    })
  })

  it('renders hostname and mode info', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: runningStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('tivify')).toBeInTheDocument()
    })
    expect(screen.getByText('HTTPS serve')).toBeInTheDocument()
  })

  it('shows error info when status has error', async () => {
    const errorStatus = { ...stoppedStatus, error: 'Container crashed' }
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: errorStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('Container crashed')).toBeInTheDocument()
    })
  })

  it('refreshes status on Refrescar click', async () => {
    mockGetTailscaleStatus.mockResolvedValue({ data: { data: runningStatus } })
    render(<TailscalePage />)
    await waitFor(() => {
      expect(screen.getByText('En ejecucion')).toBeInTheDocument()
    })
    // Clear the initial calls
    mockGetTailscaleStatus.mockClear()
    fireEvent.click(screen.getByText('Refrescar').closest('button')!)
    await waitFor(() => {
      expect(mockGetTailscaleStatus).toHaveBeenCalled()
    })
  })
})
