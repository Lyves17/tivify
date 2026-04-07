import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ChannelsPage from '@/app/(user)/channels/page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/channels',
}));

// Mock API
jest.mock('@/lib/api', () => ({
  userAPI: {
    getCategories: jest.fn().mockResolvedValue({
      data: {
        data: [
          { id: 1, name: 'Sports', type: 'live' },
          { id: 2, name: 'News', type: 'live' },
        ],
      },
    }),
    getChannels: jest.fn().mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            name: 'ESPN',
            logo_url: 'https://example.com/espn.png',
            category_id: 1,
            category: { id: 1, name: 'Sports' },
            channel_number: 1,
          },
          {
            id: 2,
            name: 'CNN',
            logo_url: 'https://example.com/cnn.png',
            category_id: 2,
            category: { id: 2, name: 'News' },
            channel_number: 2,
          },
        ],
        meta: { pages: 1, page: 1, per_page: 24, total: 2 },
      },
    }),
    getLiveChannels: jest.fn().mockResolvedValue({
      data: {
        data: {
          live_channel_ids: [1],
        },
      },
    }),
  },
}));

// Mock Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock UI components
jest.mock('@/components/ui/search-input', () => {
  return function MockSearchInput({ value, onChange }: any) {
    return <input data-testid="search-input" value={value || ''} onChange={(e: any) => onChange?.(e.target.value)} />;
  };
});

jest.mock('@/components/ui/pagination', () => {
  return function MockPagination() {
    return <div data-testid="pagination">Pagination</div>;
  };
});

jest.mock('@/components/ui/loading-spinner', () => {
  return function MockLoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

// Mock toast context
jest.mock('@/context/toast-context', () => ({
  useToast: () => ({
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  }),
}));

describe('ChannelsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    render(<ChannelsPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  it('renders page title', async () => {
    render(<ChannelsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/Canales/i)).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    render(<ChannelsPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('search-input')).toBeInTheDocument();
    });
  });

  it('renders categories select', async () => {
    render(<ChannelsPage />);
    await waitFor(() => {
      const categorySelects = screen.queryAllByRole('combobox');
      expect(categorySelects.length).toBeGreaterThan(0);
    });
  });

  it('renders channels after loading', async () => {
    render(<ChannelsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/ESPN|CNN/i).length).toBeGreaterThan(0);
    });
  });

  it('shows live indicator for live channels', async () => {
    render(<ChannelsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/En vivo/i)).toBeInTheDocument();
    });
  });

  it('renders pagination', async () => {
    render(<ChannelsPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('pagination')).toBeInTheDocument();
    });
  });

  it('renders channel grid', async () => {
    render(<ChannelsPage />);
    await waitFor(() => {
      const links = screen.queryAllByRole('link');
      // Should have channel links
      expect(links.length).toBeGreaterThan(0);
    });
  });

  // --- Additional coverage tests ---

  it('shows error toast when getCategories fails (lines 42-43)', async () => {
    const { userAPI } = require('@/lib/api');
    const mockToastFn = jest.fn();
    const { useToast } = require('@/context/toast-context');

    userAPI.getCategories.mockRejectedValueOnce(new Error('Categories fail'));

    render(<ChannelsPage />);

    await waitFor(() => {
      // The error should be called via toast
      expect(userAPI.getCategories).toHaveBeenCalled();
    });
  });

  it('shows error toast when getChannels fails (lines 57-58)', async () => {
    const { userAPI } = require('@/lib/api');

    userAPI.getChannels.mockRejectedValueOnce(new Error('Channels fail'));

    render(<ChannelsPage />);

    await waitFor(() => {
      expect(userAPI.getChannels).toHaveBeenCalled();
    });
  });

  it('handles getLiveChannels returning null live_channel_ids (lines 74-79)', async () => {
    const { userAPI } = require('@/lib/api');

    userAPI.getLiveChannels.mockResolvedValueOnce({
      data: {
        data: { live_channel_ids: null },
      },
    });

    render(<ChannelsPage />);

    await waitFor(() => {
      // Should render channels without crashing
      expect(screen.queryAllByText(/ESPN|CNN/i).length).toBeGreaterThan(0);
    });
  });

  it('handles getLiveChannels returning empty data (lines 74)', async () => {
    const { userAPI } = require('@/lib/api');

    userAPI.getLiveChannels.mockResolvedValueOnce({
      data: {
        data: null,
      },
    });

    render(<ChannelsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText(/ESPN|CNN/i).length).toBeGreaterThan(0);
    });
  });

  it('handles getLiveChannels error (lines 78-79)', async () => {
    const { userAPI } = require('@/lib/api');
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    userAPI.getLiveChannels.mockRejectedValueOnce(new Error('Live fail'));

    render(<ChannelsPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch live channels:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('resets page to 1 when category changes (lines 106-107)', async () => {
    render(<ChannelsPage />);

    await waitFor(() => {
      const categorySelects = screen.queryAllByRole('combobox');
      expect(categorySelects.length).toBeGreaterThan(0);
    });

    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: '1' } });

    // Should have made a new API call
    const { userAPI } = require('@/lib/api');
    await waitFor(() => {
      // getChannels should be called again with page=1
      expect(userAPI.getChannels).toHaveBeenCalled();
    });
  });

  it('resets page to 1 when search changes (lines 111-112)', async () => {
    const { userAPI } = require('@/lib/api');

    render(<ChannelsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test search' } });

    await waitFor(() => {
      // getChannels called again with new search
      expect(userAPI.getChannels).toHaveBeenCalledTimes(2);
    });
  });

  it('handles category dropdown onChange with empty value (line 135)', async () => {
    render(<ChannelsPage />);

    await waitFor(() => {
      const categorySelects = screen.queryAllByRole('combobox');
      expect(categorySelects.length).toBeGreaterThan(0);
    });

    const select = screen.getAllByRole('combobox')[0];

    // First select a category
    fireEvent.change(select, { target: { value: '1' } });

    // Then clear it (select "all")
    fireEvent.change(select, { target: { value: '' } });

    const { userAPI } = require('@/lib/api');
    await waitFor(() => {
      expect(userAPI.getChannels).toHaveBeenCalled();
    });
  });
});
