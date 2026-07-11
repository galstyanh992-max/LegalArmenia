import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * Chainable supabase query-builder stub. Each call site awaits the chain, so
 * the stub is thenable and resolves to whatever the test enqueued.
 */
type ChainResult = { data: unknown; error: { message: string } | null };

const insertCalls: unknown[] = [];
const updateCalls: unknown[] = [];
const orCalls: string[] = [];
let queuedResults: ChainResult[] = [];

function nextResult(): ChainResult {
  return queuedResults.length > 1 ? queuedResults.shift()! : queuedResults[0] ?? { data: [], error: null };
}

function makeChain() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ['select', 'is', 'eq', 'order', 'single', 'delete']) {
    chain[m] = vi.fn(self);
  }
  chain.or = vi.fn((expr: string) => {
    orCalls.push(expr);
    return chain;
  });
  chain.insert = vi.fn((value: unknown) => {
    insertCalls.push(value);
    return chain;
  });
  chain.update = vi.fn((value: unknown) => {
    updateCalls.push(value);
    return chain;
  });
  chain.then = (resolve: (r: ChainResult) => unknown, reject?: (e: unknown) => unknown) => {
    try {
      return Promise.resolve(resolve(nextResult()));
    } catch (e) {
      return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
    }
  };
  return chain;
}

const mockGetUser = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => makeChain(),
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

import { useCases } from '@/hooks/useCases';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  updateCalls.length = 0;
  orCalls.length = 0;
  queuedResults = [{ data: [], error: null }];
  mockGetUser.mockResolvedValue({ data: { user: { id: 'actor-1' } } });
});

// ── Case list ────────────────────────────────────────────────────────────────

describe('useCases list', () => {
  it('returns an empty list when the query yields no rows', async () => {
    const { result } = renderHook(() => useCases(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cases).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it('surfaces the error state when the list query fails (access denied)', async () => {
    queuedResults = [{ data: null, error: { message: 'permission denied' } }];
    const { result } = renderHook(() => useCases(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.cases).toEqual([]);
  });

  it('escapes LIKE metacharacters in the search filter', async () => {
    renderHook(() => useCases({ search: '50%_done\\' }), { wrapper: createWrapper() });

    await waitFor(() => expect(orCalls.length).toBeGreaterThan(0));
    expect(orCalls[0]).toContain('50\\%\\_done\\\\');
  });
});

// ── Case creation ────────────────────────────────────────────────────────────

describe('useCases create', () => {
  it('defaults lawyer_id to the acting user and strips non-writable fields', async () => {
    const { result } = renderHook(() => useCases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    queuedResults = [{ data: { id: 'c1', title: 'T' }, error: null }];

    await result.current.createCase.mutateAsync({
      title: 'T',
      case_number: 'A-1',
      // Attacker-style extras that must never reach the insert payload:
      id: 'forced-id',
      created_at: '2020-01-01',
      deleted_at: null,
    } as never);

    expect(insertCalls).toHaveLength(1);
    const payload = insertCalls[0] as Record<string, unknown>;
    expect(payload.lawyer_id).toBe('actor-1');
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('deleted_at');
  });

  it('retries with a suffixed case_number on duplicate-key conflicts', async () => {
    const { result } = renderHook(() => useCases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    queuedResults = [
      { data: null, error: { message: 'duplicate key value violates unique constraint "cases_case_number_active_key"' } },
      { data: { id: 'c1', case_number: 'A-1-1' }, error: null },
    ];

    const created = await result.current.createCase.mutateAsync({
      title: 'T',
      case_number: 'A-1',
    } as never);

    expect((created as { case_number: string }).case_number).toBe('A-1-1');
    expect(insertCalls).toHaveLength(2);
    expect((insertCalls[1] as Record<string, unknown>).case_number).toBe('A-1-1');
  });

  it('rejects when the insert fails for a non-duplicate reason (RLS denial)', async () => {
    const { result } = renderHook(() => useCases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    queuedResults = [{ data: null, error: { message: 'new row violates row-level security policy' } }];

    await expect(
      result.current.createCase.mutateAsync({ title: 'T', case_number: 'A-1' } as never)
    ).rejects.toMatchObject({ message: expect.stringContaining('row-level security') });
    expect(insertCalls).toHaveLength(1);
  });
});

// ── Case edit ────────────────────────────────────────────────────────────────

describe('useCases update', () => {
  it('sends only whitelisted columns in updates', async () => {
    const { result } = renderHook(() => useCases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    queuedResults = [{ data: { id: 'c1' }, error: null }];

    await result.current.updateCase.mutateAsync({
      id: 'c1',
      updates: {
        title: 'New',
        status: 'active',
        // Must be stripped:
        id: 'other-id',
        created_at: '2020-01-01',
        updated_at: '2020-01-01',
        deleted_at: '2020-01-01',
      } as never,
    });

    expect(updateCalls).toHaveLength(1);
    const payload = updateCalls[0] as Record<string, unknown>;
    expect(payload).toEqual({ title: 'New', status: 'active' });
  });

  it('propagates unauthorized-edit failures to the caller', async () => {
    const { result } = renderHook(() => useCases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    queuedResults = [{ data: null, error: { message: 'permission denied for view cases' } }];

    await expect(
      result.current.updateCase.mutateAsync({ id: 'c1', updates: { title: 'X' } })
    ).rejects.toMatchObject({ message: expect.stringContaining('permission denied') });
  });
});
