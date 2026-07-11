import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase client mock ─────────────────────────────────────────────────────

const uploadMock = vi.fn();
const removeMock = vi.fn();
const insertResultQueue: Array<{ data: unknown; error: { message: string } | null }> = [];

function tableChain() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ['select', 'eq', 'order', 'limit', 'insert']) {
    chain[m] = vi.fn(self);
  }
  chain.single = vi.fn(async () => insertResultQueue.shift() ?? { data: null, error: null });
  chain.then = (resolve: (r: unknown) => unknown) =>
    Promise.resolve(resolve({ data: [], error: null }));
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => tableChain(),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => uploadMock(...args),
        remove: (...args: unknown[]) => removeMock(...args),
      }),
    },
  },
}));

import { uploadCaseFileWithMetadata } from '@/lib/caseFileUpload';

function makeFile(name: string, type = 'application/pdf'): File {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type });
  // jsdom's File lacks arrayBuffer(); polyfill it for computeSHA256.
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });
  }
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  insertResultQueue.length = 0;
  uploadMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({ error: null });
});

describe('uploadCaseFileWithMetadata', () => {
  it('uploads under a generated case-scoped key, never the raw filename', async () => {
    insertResultQueue.push({ data: { id: 'f1', version: 1 }, error: null });

    const { storagePath } = await uploadCaseFileWithMetadata({
      caseId: 'case-1',
      file: makeFile('ԴԱՏԱԿԱՆ ակտ.pdf'),
      userId: 'u1',
    });

    expect(storagePath).toMatch(/^case-1\/[0-9a-f-]{36}\.pdf$/);
    expect(storagePath).not.toContain('ԴԱՏԱԿԱՆ');
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock.mock.calls[0][0]).toBe(storagePath);
  });

  it('removes the uploaded object when the metadata insert fails (no orphan binary)', async () => {
    insertResultQueue.push({ data: null, error: { message: 'insert denied' } });

    await expect(
      uploadCaseFileWithMetadata({ caseId: 'case-1', file: makeFile('a.pdf'), userId: 'u1' })
    ).rejects.toMatchObject({ message: 'insert denied' });

    expect(removeMock).toHaveBeenCalledTimes(1);
    const removedPaths = removeMock.mock.calls[0][0] as string[];
    expect(removedPaths[0]).toMatch(/^case-1\//);
  });

  it('does not upload when an existing storagePath is supplied (no double write)', async () => {
    insertResultQueue.push({ data: { id: 'f1', version: 1 }, error: null });

    await uploadCaseFileWithMetadata({
      caseId: 'case-1',
      file: makeFile('a.pdf'),
      userId: 'u1',
      storagePath: 'case-1/preuploaded.pdf',
    });

    expect(uploadMock).not.toHaveBeenCalled();
  });
});
