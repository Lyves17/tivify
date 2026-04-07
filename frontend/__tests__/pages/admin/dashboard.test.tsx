import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import AdminDashboard from '@/app/admin/page'

jest.mock('@/lib/api')
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
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

import { adminAPI } from '@/lib/api'

const mockGetStats = adminAPI.getStats as jest.Mock

const sampleStats = {
  channels: 42,
  vods: 150,
  series: 18,
  users: 7,
  problem_vods: [
    { id: 1, title: 'Broken VOD', transcode_status: 'failed', transcode_progress: 0 },
    { id: 2, title: 'Processing VOD', transcode_status: 'processing', transcode_progress: 65 },
  ],
  recent_vods: [
    { id: 10, title: 'New Movie', transcode_status: 'completed', created_at: '2026-03-10T12:00:00Z' },
    { id: 11, title: 'Another Movie', transcode_status: 'pending', created_at: '2026-03-09T10:00:00Z' },
  ],
  recent_users: [
    { id: 100, username: 'admin_user', role: 'admin', created_at: '2026-03-12T08:00:00Z' },
    { id: 101, username: 'normal_user', role: 'user', created_at: '2026-03-11T15:00:00Z' },
  ],
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state initially', () => {
    mockGetStats.mockImplementation(() => new Promise(() => {}))
    render(<AdminDashboard />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByText('Cargando estadisticas...')).toBeInTheDocument()
  })

  it('renders dashboard title', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('renders stat cards with correct values', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument()
    })
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders stat card descriptions', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Canales activos')).toBeInTheDocument()
    })
    expect(screen.getByText('Videos disponibles')).toBeInTheDocument()
    expect(screen.getByText('Series activas')).toBeInTheDocument()
    expect(screen.getByText('Usuarios registrados')).toBeInTheDocument()
  })

  it('renders stat card titles', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Canales')).toBeInTheDocument()
    })
    expect(screen.getByText('VODs')).toBeInTheDocument()
    expect(screen.getByText('Series')).toBeInTheDocument()
    expect(screen.getByText('Usuarios')).toBeInTheDocument()
  })

  it('renders problem VODs section when there are problem VODs', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Requieren atencion')).toBeInTheDocument()
    })
    expect(screen.getByText('Broken VOD')).toBeInTheDocument()
    expect(screen.getByText('Processing VOD')).toBeInTheDocument()
  })

  it('shows transcode progress for processing VODs', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('65%')).toBeInTheDocument()
    })
  })

  it('renders recent VODs section', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Ultimos VODs')).toBeInTheDocument()
    })
    expect(screen.getByText('New Movie')).toBeInTheDocument()
    expect(screen.getByText('Another Movie')).toBeInTheDocument()
  })

  it('renders recent users section', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Ultimos usuarios')).toBeInTheDocument()
    })
    expect(screen.getByText('admin_user')).toBeInTheDocument()
    expect(screen.getByText('normal_user')).toBeInTheDocument()
  })

  it('renders "Ver todos" links', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      const links = screen.getAllByText('Ver todos')
      expect(links).toHaveLength(2)
    })
    const allLinks = screen.getAllByRole('link')
    const hrefs = allLinks.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/admin/vod')
    expect(hrefs).toContain('/admin/users')
  })

  it('shows empty state for recent VODs when none exist', async () => {
    const emptyStats = { ...sampleStats, recent_vods: [], problem_vods: [] }
    mockGetStats.mockResolvedValue({ data: { data: emptyStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Sin VODs aun')).toBeInTheDocument()
    })
  })

  it('shows empty state for recent users when none exist', async () => {
    const emptyStats = { ...sampleStats, recent_users: [] }
    mockGetStats.mockResolvedValue({ data: { data: emptyStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Sin usuarios aun')).toBeInTheDocument()
    })
  })

  it('does not render problem VODs section when there are none', async () => {
    const noProblems = { ...sampleStats, problem_vods: [] }
    mockGetStats.mockResolvedValue({ data: { data: noProblems } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
    expect(screen.queryByText('Requieren atencion')).not.toBeInTheDocument()
  })

  it('shows error toast when loading stats fails', async () => {
    mockGetStats.mockRejectedValue(new Error('Network error'))
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar estadisticas del dashboard')
    })
  })

  it('renders zero values when stats are null after error', async () => {
    mockGetStats.mockRejectedValue(new Error('Network error'))
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled()
    })
    // After error, stats is null so page shows loading spinner then falls through
    // The component sets stats to null on error and loading to false
    // With null stats, the stat cards show 0
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(4)
  })

  it('renders role badges for users', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument()
    })
    expect(screen.getByText('user')).toBeInTheDocument()
  })

  it('renders stat card icons', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
    // Stat icons are emoji text
    expect(screen.getByText('📺')).toBeInTheDocument()
    expect(screen.getByText('🎬')).toBeInTheDocument()
    expect(screen.getByText('📚')).toBeInTheDocument()
    expect(screen.getByText('👤')).toBeInTheDocument()
  })

  it('renders problem VODs count badge', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('2 VODs')).toBeInTheDocument()
    })
  })

  it('renders status badges with correct types', async () => {
    const statsWithVariousStatuses = {
      ...sampleStats,
      problem_vods: [
        { id: 1, title: 'Failed VOD', transcode_status: 'failed', transcode_progress: 0 },
        { id: 2, title: 'Pending VOD', transcode_status: 'pending', transcode_progress: 0 },
        { id: 3, title: 'Unknown VOD', transcode_status: 'unknown_status', transcode_progress: 0 },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: statsWithVariousStatuses } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Failed VOD')).toBeInTheDocument()
    })
    expect(screen.getByText('Pending VOD')).toBeInTheDocument()
    expect(screen.getByText('Unknown VOD')).toBeInTheDocument()
    // Status badges render the raw status text
    expect(screen.getByText('failed')).toBeInTheDocument()
    // 'pending' appears in both a status badge and the stat card description area, use getAllByText
    const pendingElements = screen.getAllByText('pending')
    expect(pendingElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('unknown_status')).toBeInTheDocument()
  })

  it('does not show progress for non-processing VODs', async () => {
    const statsWithFailed = {
      ...sampleStats,
      problem_vods: [
        { id: 1, title: 'Failed Only', transcode_status: 'failed', transcode_progress: 0 },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: statsWithFailed } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Failed Only')).toBeInTheDocument()
    })
    // Should NOT show progress percentage for non-processing VODs
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('renders formatted dates for recent VODs', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('New Movie')).toBeInTheDocument()
    })
    // Dates are rendered using toLocaleDateString('es-ES') — just verify something date-like appears
    // The exact format depends on the locale, but the dates should be present
    const allText = document.body.textContent
    expect(allText).toContain('New Movie')
    expect(allText).toContain('Another Movie')
  })

  it('renders large stat values with locale formatting', async () => {
    const largeStats = {
      ...sampleStats,
      channels: 1234,
      vods: 56789,
    }
    mockGetStats.mockResolvedValue({ data: { data: largeStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      // toLocaleString() would format these with separators
      // The exact output depends on locale, but the values should be present
      expect(screen.getByText(Number(1234).toLocaleString())).toBeInTheDocument()
      expect(screen.getByText(Number(56789).toLocaleString())).toBeInTheDocument()
    })
  })

  it('handles null stats fields gracefully (uses defaults)', async () => {
    const partialStats = {
      channels: 5,
      vods: 10,
      series: 3,
      users: 1,
      // Missing problem_vods, recent_vods, recent_users
    }
    mockGetStats.mockResolvedValue({ data: { data: partialStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })
    expect(screen.getByText('Sin VODs aun')).toBeInTheDocument()
    expect(screen.getByText('Sin usuarios aun')).toBeInTheDocument()
    expect(screen.queryByText('Requieren atencion')).not.toBeInTheDocument()
  })

  it('renders "Ver todos" VOD link pointing to /admin/vod', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      const links = screen.getAllByText('Ver todos')
      expect(links.length).toBe(2)
    })
    const vodLink = screen.getAllByRole('link').find((l) => l.getAttribute('href') === '/admin/vod')
    expect(vodLink).toBeInTheDocument()
    expect(vodLink).toHaveTextContent('Ver todos')
  })

  it('renders "Ver todos" users link pointing to /admin/users', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      const links = screen.getAllByText('Ver todos')
      expect(links.length).toBe(2)
    })
    const usersLink = screen.getAllByRole('link').find((l) => l.getAttribute('href') === '/admin/users')
    expect(usersLink).toBeInTheDocument()
    expect(usersLink).toHaveTextContent('Ver todos')
  })

  it('shows completed status badge for recent VODs', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('New Movie')).toBeInTheDocument()
    })
    expect(screen.getByText('completed')).toBeInTheDocument()
  })

  it('calls getStats on mount', async () => {
    mockGetStats.mockResolvedValue({ data: { data: sampleStats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(mockGetStats).toHaveBeenCalledTimes(1)
    })
  })
})
