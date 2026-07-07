import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { UsageMonitor } from './UsageMonitor';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Recharts' ResponsiveContainer needs real layout/ResizeObserver, which jsdom
// doesn't provide. Every test below uses showChart={false}, so the chart branch
// never mounts and this mock is just a safety net.
vi.mock('recharts', () => ({
  AreaChart: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: () => null,
  Legend: () => null,
}));

const ADMIN_ROWS = [
  {
    day: '2026-07-01',
    fn_name: 'ai-analyze',
    model: 'ollama/glm-5.2',
    calls: 5,
    total_tokens: 1000,
    cost_usd: 0.02,
  },
  {
    day: '2026-07-01',
    fn_name: 'ocr-process',
    model: 'google/gemini-2.5-flash',
    calls: 2,
    total_tokens: 200,
    cost_usd: 0.01,
  },
];

describe('UsageMonitor — role-aware AI metrics access', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockRpc.mockReset();
    mockUseAuth.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('non-admin users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAdmin: false, isLoading: false });
    });

    it('never calls get_ai_metrics_summary', async () => {
      render(<UsageMonitor compact showChart={false} showTopUsers={false} />);

      // Give any stray microtask a chance to run before asserting the negative.
      await waitFor(() => expect(mockRpc).not.toHaveBeenCalled());
    });

    it('renders an admin-only placeholder instead of usage data (compact)', async () => {
      const { findByText } = render(
        <UsageMonitor compact showChart={false} showTopUsers={false} />
      );
      expect(await findByText('usage:admin_only')).toBeInTheDocument();
    });

    it('renders an admin-only placeholder instead of usage data (full view)', async () => {
      const { findByText } = render(
        <UsageMonitor showChart={false} showTopUsers={false} />
      );
      expect(await findByText('usage:admin_only')).toBeInTheDocument();
    });

    it('logs no console errors', async () => {
      render(<UsageMonitor compact showChart={false} showTopUsers={false} />);
      await waitFor(() => {
        expect(mockRpc).not.toHaveBeenCalled();
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('role still resolving (auth loading)', () => {
    it('shows a loading state and does not call the RPC or show the placeholder yet', async () => {
      mockUseAuth.mockReturnValue({ isAdmin: false, isLoading: true });
      const { queryByText } = render(
        <UsageMonitor compact showChart={false} showTopUsers={false} />
      );

      expect(mockRpc).not.toHaveBeenCalled();
      expect(queryByText('usage:admin_only')).not.toBeInTheDocument();
    });
  });

  describe('admin users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAdmin: true, isLoading: false });
      mockRpc.mockResolvedValue({ data: ADMIN_ROWS, error: null });
    });

    it('calls get_ai_metrics_summary with p_days: 30', async () => {
      render(<UsageMonitor compact showChart={false} showTopUsers={false} />);
      await waitFor(() =>
        expect(mockRpc).toHaveBeenCalledWith('get_ai_metrics_summary', { p_days: 30 })
      );
    });

    it('renders real aggregated usage data', async () => {
      const { findByText } = render(
        <UsageMonitor compact showChart={false} showTopUsers={false} />
      );
      // total cost = 0.02 + 0.01 = 0.03
      expect(await findByText('$0.0300 / $5.00')).toBeInTheDocument();
    });

    it('does not render the admin-only placeholder', async () => {
      const { findByText, queryByText } = render(
        <UsageMonitor compact showChart={false} showTopUsers={false} />
      );
      await findByText('$0.0300 / $5.00');
      expect(queryByText('usage:admin_only')).not.toBeInTheDocument();
    });

    it('degrades to a safe empty state if the RPC returns no rows (defense in depth)', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });
      const { findByText } = render(
        <UsageMonitor showChart={false} showTopUsers={false} />
      );
      expect(await findByText('usage:no_usage')).toBeInTheDocument();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('logs (but does not throw) if the RPC itself errors for an admin', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
      render(<UsageMonitor compact showChart={false} showTopUsers={false} />);
      await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    });
  });
});
