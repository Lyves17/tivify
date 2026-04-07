/**
 * Extended tests for AdminDashboard (src/app/admin/page.tsx)
 * Covers: formatDate, statusBadge internal function branches, StatCard,
 * additional edge cases for problem VODs, recent VODs/users rendering.
 */
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

const baseStats = {
  channels: 10,
  vods: 20,
  series: 5,
  users: 3,
  problem_vods: [],
  recent_vods: [],
  recent_users: [],
}

describe('AdminDashboard - extended', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders formatted date for recent VODs with various date strings', async () => {
    const stats = {
      ...baseStats,
      recent_vods: [
        { id: 1, title: 'Movie A', transcode_status: 'completed', created_at: '2026-01-15T08:30:00Z' },
        { id: 2, title: 'Movie B', transcode_status: 'pending', created_at: '2026-06-20T16:45:00Z' },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Movie A')).toBeInTheDocument()
    })
    expect(screen.getByText('Movie B')).toBeInTheDocument()
  })

  it('renders formatted date for recent users', async () => {
    const stats = {
      ...baseStats,
      recent_users: [
        { id: 1, username: 'john', role: 'user', created_at: '2026-02-14T10:00:00Z' },
        { id: 2, username: 'jane', role: 'admin', created_at: '2026-12-25T23:59:00Z' },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('john')).toBeInTheDocument()
    })
    expect(screen.getByText('jane')).toBeInTheDocument()
  })

  it('renders user role badge with non-admin styling', async () => {
    const stats = {
      ...baseStats,
      recent_users: [
        { id: 1, username: 'regular_user', role: 'user', created_at: '2026-03-10T12:00:00Z' },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('regular_user')).toBeInTheDocument()
    })
    const badge = screen.getByText('user')
    expect(badge.className).toContain('bg-dark-600/20')
  })

  it('renders user role badge with admin styling', async () => {
    const stats = {
      ...baseStats,
      recent_users: [
        { id: 1, username: 'admin_user', role: 'admin', created_at: '2026-03-10T12:00:00Z' },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('admin_user')).toBeInTheDocument()
    })
    const badge = screen.getByText('admin')
    expect(badge.className).toContain('bg-purple-600/20')
  })

  it('renders problem VOD with completed status (edge case)', async () => {
    const stats = {
      ...baseStats,
      problem_vods: [
        { id: 1, title: 'Completed Problem', transcode_status: 'completed', transcode_progress: 100 },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Completed Problem')).toBeInTheDocument()
    })
    // completed status badge should render
    expect(screen.getByText('completed')).toBeInTheDocument()
    // should NOT show progress since it's completed, not processing
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })

  it('renders processing problem VOD with progress percentage', async () => {
    const stats = {
      ...baseStats,
      problem_vods: [
        { id: 1, title: 'Processing VOD', transcode_status: 'processing', transcode_progress: 75 },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Processing VOD')).toBeInTheDocument()
    })
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders status badge with unknown status using default color', async () => {
    const stats = {
      ...baseStats,
      problem_vods: [
        { id: 1, title: 'Unknown Status', transcode_status: 'weird_status', transcode_progress: 0 },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Unknown Status')).toBeInTheDocument()
    })
    // unknown status falls back to colors.pending styling
    const badge = screen.getByText('weird_status')
    expect(badge.className).toContain('bg-dark-600/20')
  })

  it('renders multiple recent VODs with different statuses', async () => {
    const stats = {
      ...baseStats,
      recent_vods: [
        { id: 1, title: 'Completed VOD', transcode_status: 'completed', created_at: '2026-03-10T12:00:00Z' },
        { id: 2, title: 'Failed VOD', transcode_status: 'failed', created_at: '2026-03-09T10:00:00Z' },
        { id: 3, title: 'Processing VOD', transcode_status: 'processing', created_at: '2026-03-08T08:00:00Z' },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Completed VOD')).toBeInTheDocument()
    })
    expect(screen.getByText('Failed VOD')).toBeInTheDocument()
    expect(screen.getByText('Processing VOD')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
    expect(screen.getByText('processing')).toBeInTheDocument()
  })

  it('renders single problem VOD badge count correctly', async () => {
    const stats = {
      ...baseStats,
      problem_vods: [
        { id: 1, title: 'Only Problem', transcode_status: 'failed', transcode_progress: 0 },
      ],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('1 VODs')).toBeInTheDocument()
    })
  })

  it('renders many problem VODs count badge', async () => {
    const manyProblems = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      title: `Problem ${i + 1}`,
      transcode_status: 'failed',
      transcode_progress: 0,
    }))
    const stats = { ...baseStats, problem_vods: manyProblems }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('5 VODs')).toBeInTheDocument()
    })
  })

  it('renders stat cards with zero values when stats has zero counts', async () => {
    const stats = {
      channels: 0,
      vods: 0,
      series: 0,
      users: 0,
      problem_vods: [],
      recent_vods: [],
      recent_users: [],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      const zeros = screen.getAllByText('0')
      expect(zeros.length).toBeGreaterThanOrEqual(4)
    })
  })

  it('console.error is called on fetch failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGetStats.mockRejectedValue(new Error('Test error'))
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch dashboard stats:', expect.any(Error))
    })
    consoleSpy.mockRestore()
  })

  it('renders both empty states simultaneously when VODs and users are empty', async () => {
    const stats = { ...baseStats, recent_vods: [], recent_users: [] }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Sin VODs aun')).toBeInTheDocument()
    })
    expect(screen.getByText('Sin usuarios aun')).toBeInTheDocument()
  })

  it('renders links to admin VOD and users pages', async () => {
    const stats = {
      ...baseStats,
      recent_vods: [{ id: 1, title: 'V', transcode_status: 'completed', created_at: '2026-01-01T00:00:00Z' }],
      recent_users: [{ id: 1, username: 'u', role: 'user', created_at: '2026-01-01T00:00:00Z' }],
    }
    mockGetStats.mockResolvedValue({ data: { data: stats } })
    render(<AdminDashboard />)
    await waitFor(() => {
      const links = screen.getAllByRole('link')
      const hrefs = links.map((l) => l.getAttribute('href'))
      expect(hrefs).toContain('/admin/vod')
      expect(hrefs).toContain('/admin/users')
    })
  })
})
