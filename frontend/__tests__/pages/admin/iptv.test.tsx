import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import IPTVPage from '@/app/admin/iptv/page'

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

const mockIptvStatus = adminAPI.iptvStatus as jest.Mock
const mockIptvImport = adminAPI.iptvImport as jest.Mock
const mockIptvDeleteBySource = adminAPI.iptvDeleteBySource as jest.Mock
const mockGetStats = adminAPI.getStats as jest.Mock

describe('IPTVPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: no import running, stats available
    mockIptvStatus.mockResolvedValue({
      data: { data: { running: false, current: 0, total: 0, percent: 0, imported: 0, error: '', message: '' } },
    })
    mockGetStats.mockResolvedValue({
      data: { data: { channels: 100 } },
    })
    // Mock window.confirm for delete
    window.confirm = jest.fn(() => true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders page title', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Importación IPTV')).toBeInTheDocument()
    })
  })

  it('renders description text', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Importa canales desde cualquier lista M3U/)).toBeInTheDocument()
    })
  })

  it('renders preset URL selector', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Fuente M3U')).toBeInTheDocument()
    })
  })

  it('renders channel count stats after loading', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Total canales')).toBeInTheDocument()
    })
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('renders country filter section', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Filtrar por país/)).toBeInTheDocument()
    })
  })

  it('renders language filter section', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Filtrar por idioma/)).toBeInTheDocument()
    })
  })

  it('renders category filter section', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Filtrar por categoría/)).toBeInTheDocument()
    })
  })

  it('renders import button', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Iniciar importación/)).toBeInTheDocument()
    })
  })

  it('renders source tag input with default value', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Etiqueta de fuente')).toBeInTheDocument()
    })
    const sourceInput = screen.getByDisplayValue('iptv-org')
    expect(sourceInput).toBeInTheDocument()
  })

  it('renders replace checkbox', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Reemplazar canales IPTV existentes')).toBeInTheDocument()
    })
  })

  it('toggles country filter when clicking a country button', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/España \(ES\)/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/España \(ES\)/))
    await waitFor(() => {
      // Filter summary should appear
      expect(screen.getByText('Filtros activos:')).toBeInTheDocument()
      expect(screen.getByText(/Países: ES/)).toBeInTheDocument()
    })
  })

  it('toggles language filter', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Español')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Español'))
    await waitFor(() => {
      expect(screen.getByText('Filtros activos:')).toBeInTheDocument()
      expect(screen.getByText(/Idiomas: Spanish/)).toBeInTheDocument()
    })
  })

  it('toggles category filter', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('News')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('News'))
    await waitFor(() => {
      expect(screen.getByText('Filtros activos:')).toBeInTheDocument()
    })
  })

  it('clears all filters when clicking "Limpiar filtros"', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/España \(ES\)/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/España \(ES\)/))
    await waitFor(() => {
      expect(screen.getByText('Limpiar filtros')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Limpiar filtros'))
    await waitFor(() => {
      expect(screen.queryByText('Filtros activos:')).not.toBeInTheDocument()
    })
  })

  it('shows confirm dialog when replace is enabled and import is clicked', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Iniciar importación/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Iniciar importación/))
    await waitFor(() => {
      expect(screen.getByText('Confirmar y continuar')).toBeInTheDocument()
    })
  })

  it('starts import when confirmed', async () => {
    mockIptvImport.mockResolvedValue({ data: {} })
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Iniciar importación/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Iniciar importación/))
    await waitFor(() => {
      expect(screen.getByText('Confirmar y continuar')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirmar y continuar'))
    await waitFor(() => {
      expect(mockIptvImport).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Importación iniciada en segundo plano')
    })
  })

  it('shows error toast when import fails', async () => {
    mockIptvImport.mockRejectedValue({ response: { data: { message: 'Import failed' } } })
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Iniciar importación/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Iniciar importación/))
    await waitFor(() => {
      expect(screen.getByText('Confirmar y continuar')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirmar y continuar'))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Import failed')
    })
  })

  it('shows custom URL input when "URL personalizada" is selected', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Fuente M3U')).toBeInTheDocument()
    })
    const select = screen.getByDisplayValue(/Todos los países/)
    fireEvent.change(select, { target: { value: 'custom' } })
    await waitFor(() => {
      // Multiple inputs may match; use getAllByPlaceholderText and check at least one is the M3U input
      const inputs = screen.getAllByPlaceholderText(/ejemplo.com/)
      expect(inputs.length).toBeGreaterThanOrEqual(1)
      const m3uInput = inputs.find((i) => i.getAttribute('placeholder')?.includes('lista.m3u'))
      expect(m3uInput).toBeTruthy()
    })
  })

  it('deletes IPTV channels by source', async () => {
    mockIptvDeleteBySource.mockResolvedValue({})
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Total canales')).toBeInTheDocument()
    })
    // The delete button has emoji and title
    const deleteButton = screen.getByTitle(/Eliminar canales/)
    fireEvent.click(deleteButton)
    await waitFor(() => {
      expect(mockIptvDeleteBySource).toHaveBeenCalledWith('iptv-org')
      expect(mockToast.success).toHaveBeenCalledWith('Canales IPTV eliminados')
    })
  })

  it('shows error toast when delete fails', async () => {
    mockIptvDeleteBySource.mockRejectedValue(new Error('fail'))
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Total canales')).toBeInTheDocument()
    })
    const deleteButton = screen.getByTitle(/Eliminar canales/)
    fireEvent.click(deleteButton)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error eliminando canales')
    })
  })

  it('renders info section', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Cómo funciona/)).toBeInTheDocument()
    })
  })

  it('shows import progress when running', async () => {
    mockIptvStatus.mockResolvedValue({
      data: {
        data: {
          running: true,
          current: 50,
          total: 200,
          percent: 25,
          imported: 0,
          error: '',
          message: 'Processing...',
        },
      },
    })
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Importando...')).toBeInTheDocument()
    })
    expect(screen.getByText('50 / 200')).toBeInTheDocument()
  })

  it('cancels confirm dialog when clicking Cancelar', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Iniciar importación/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Iniciar importación/))
    await waitFor(() => {
      expect(screen.getByText('Confirmar y continuar')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancelar'))
    await waitFor(() => {
      expect(screen.queryByText('Confirmar y continuar')).not.toBeInTheDocument()
    })
  })

  // --- NEW TESTS for coverage of uncovered lines ---

  it('starts polling when initial status shows running', async () => {
    mockIptvStatus.mockResolvedValue({
      data: {
        data: {
          running: true,
          current: 10,
          total: 100,
          percent: 10,
          imported: 0,
          error: '',
          message: 'In progress...',
        },
      },
    })
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Importando...')).toBeInTheDocument()
      expect(screen.getByText('10 / 100')).toBeInTheDocument()
    })
  })

  it('poll stops and refreshes stats when import finishes', async () => {
    jest.useFakeTimers()
    // Initial status: running
    mockIptvStatus
      .mockResolvedValueOnce({
        data: {
          data: { running: true, current: 50, total: 100, percent: 50, imported: 0, error: '', message: 'Working...' },
        },
      })
    mockIptvImport.mockResolvedValue({ data: {} })

    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Importando...')).toBeInTheDocument()
    })

    // Now the poll interval fires: return not running
    mockIptvStatus.mockResolvedValue({
      data: {
        data: { running: false, current: 100, total: 100, percent: 100, imported: 95, error: '', message: 'Done' },
      },
    })

    jest.advanceTimersByTime(1500)
    await waitFor(() => {
      expect(mockIptvStatus).toHaveBeenCalledTimes(2) // initial + 1 poll
    })

    jest.useRealTimers()
  })

  it('poll stops on error', async () => {
    jest.useFakeTimers()
    mockIptvStatus
      .mockResolvedValueOnce({
        data: {
          data: { running: true, current: 10, total: 100, percent: 10, imported: 0, error: '', message: 'Working' },
        },
      })

    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Importando...')).toBeInTheDocument()
    })

    // Poll throws error
    mockIptvStatus.mockRejectedValue(new Error('network error'))
    jest.advanceTimersByTime(1500)

    await waitFor(() => {
      expect(mockIptvStatus).toHaveBeenCalledTimes(2)
    })

    jest.useRealTimers()
  })

  it('imports directly without confirm when replace is unchecked', async () => {
    mockIptvImport.mockResolvedValue({ data: {} })
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Reemplazar canales IPTV existentes')).toBeInTheDocument()
    })
    // Uncheck replace
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    fireEvent.click(screen.getByText(/Iniciar importación/))
    await waitFor(() => {
      // Should NOT show confirm dialog, import directly
      expect(mockIptvImport).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Importación iniciada en segundo plano')
    })
  })

  it('shows generic error when import fails without response message', async () => {
    mockIptvImport.mockRejectedValue(new Error('network error'))
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/Iniciar importación/)).toBeInTheDocument()
    })
    // Uncheck replace to skip confirm
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText(/Iniciar importación/))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error iniciando importación')
    })
  })

  it('imports with custom URL', async () => {
    mockIptvImport.mockResolvedValue({ data: {} })
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Fuente M3U')).toBeInTheDocument()
    })
    // Select custom
    const select = screen.getByDisplayValue(/Todos los países/)
    fireEvent.change(select, { target: { value: 'custom' } })
    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText(/ejemplo.com/)
      expect(inputs.length).toBeGreaterThanOrEqual(1)
    })
    // Type custom URL
    const m3uInput = screen.getAllByPlaceholderText(/ejemplo.com/).find(
      (i) => i.getAttribute('placeholder')?.includes('lista.m3u')
    )!
    fireEvent.change(m3uInput, { target: { value: 'https://custom.com/list.m3u' } })

    // Uncheck replace to skip confirm
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    fireEvent.click(screen.getByText(/Iniciar importación/))
    await waitFor(() => {
      expect(mockIptvImport).toHaveBeenCalledWith(
        expect.objectContaining({ m3u_url: 'https://custom.com/list.m3u' })
      )
    })
  })

  it('disables import button when custom URL is empty', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Fuente M3U')).toBeInTheDocument()
    })
    // Select custom
    const select = screen.getByDisplayValue(/Todos los países/)
    fireEvent.change(select, { target: { value: 'custom' } })
    // Import button should be disabled since custom URL is empty
    const importButton = screen.getByText(/Iniciar importación/)
    expect(importButton).toBeDisabled()
  })

  it('shows completed status with imported count', async () => {
    mockIptvStatus.mockResolvedValue({
      data: {
        data: {
          running: false,
          current: 100,
          total: 100,
          percent: 100,
          imported: 95,
          error: '',
          message: 'Import complete',
        },
      },
    })
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Completado')).toBeInTheDocument()
      expect(screen.getByText(/95 canales importados/)).toBeInTheDocument()
    })
  })

  it('shows error status from initial load', async () => {
    mockIptvStatus.mockResolvedValue({
      data: {
        data: {
          running: false,
          current: 0,
          total: 0,
          percent: 0,
          imported: 0,
          error: 'Something went wrong',
          message: 'Import failed with errors',
        },
      },
    })
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  it('does not delete when confirm is cancelled', async () => {
    window.confirm = jest.fn(() => false)
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Total canales')).toBeInTheDocument()
    })
    const deleteButton = screen.getByTitle(/Eliminar canales/)
    fireEvent.click(deleteButton)
    expect(mockIptvDeleteBySource).not.toHaveBeenCalled()
  })

  it('sends filters in import request', async () => {
    mockIptvImport.mockResolvedValue({ data: {} })
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/España \(ES\)/)).toBeInTheDocument()
    })
    // Select country
    fireEvent.click(screen.getByText(/España \(ES\)/))
    // Select language
    fireEvent.click(screen.getByText('Español'))
    // Select category
    fireEvent.click(screen.getByText('News'))

    // Uncheck replace to skip confirm
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    fireEvent.click(screen.getByText(/Iniciar importación/))
    await waitFor(() => {
      expect(mockIptvImport).toHaveBeenCalledWith(
        expect.objectContaining({
          countries: ['ES'],
          languages: ['Spanish'],
          categories: ['News'],
          replace: false,
        })
      )
    })
  })

  it('changes source input', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByDisplayValue('iptv-org')).toBeInTheDocument()
    })
    const sourceInput = screen.getByDisplayValue('iptv-org')
    fireEvent.change(sourceInput, { target: { value: 'my-provider' } })
    expect(screen.getByDisplayValue('my-provider')).toBeInTheDocument()
  })

  it('deselects a toggled country filter', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText(/España \(ES\)/)).toBeInTheDocument()
    })
    // Toggle on
    fireEvent.click(screen.getByText(/España \(ES\)/))
    await waitFor(() => {
      expect(screen.getByText('Filtros activos:')).toBeInTheDocument()
    })
    // Toggle off
    fireEvent.click(screen.getByText(/España \(ES\)/))
    await waitFor(() => {
      expect(screen.queryByText('Filtros activos:')).not.toBeInTheDocument()
    })
  })

  it('handles stats fetch failure silently', async () => {
    mockGetStats.mockRejectedValue(new Error('fail'))
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Importación IPTV')).toBeInTheDocument()
    })
    // No channelCount block should render
    expect(screen.queryByText('Total canales')).not.toBeInTheDocument()
  })

  it('handles initial iptvStatus failure silently', async () => {
    mockIptvStatus.mockRejectedValue(new Error('fail'))
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('Importación IPTV')).toBeInTheDocument()
    })
    // Page still renders
    expect(screen.getByText(/Iniciar importación/)).toBeInTheDocument()
  })

  it('changes EPG URL input', async () => {
    render(<IPTVPage />)
    await waitFor(() => {
      expect(screen.getByText('URL EPG (XMLTV, opcional)')).toBeInTheDocument()
    })
    const epgInput = screen.getByPlaceholderText(/epg.xml.gz/)
    fireEvent.change(epgInput, { target: { value: 'https://example.com/epg.xml' } })
    expect(epgInput).toHaveValue('https://example.com/epg.xml')
  })
})
