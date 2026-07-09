import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { CasePdfUpload } from './CasePdfUpload';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  upload: vi.fn(),
  signedUrl: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: mocks.upload,
        createSignedUrl: mocks.signedUrl,
        remove: vi.fn(),
      }),
    },
    functions: { invoke: mocks.invoke },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u' } } }) },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

describe('CasePdfUpload OCR AI-generated disclaimer', () => {
  beforeEach(() => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.signedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.com/x' }, error: null });
    mocks.invoke.mockResolvedValue({ data: { extracted_text: 'Sample OCR text', confidence_score: 0.95 }, error: null });
  });

  it('marks OCR extracted text as AI-generated', async () => {
    render(
      <CasePdfUpload open onOpenChange={vi.fn()} caseId="case-1" onSuccess={vi.fn()} />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadBtn = await waitFor(() =>
      Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('ocr:ocr_title'))
    );
    expect(uploadBtn).toBeTruthy();
    fireEvent.click(uploadBtn!);

    await waitFor(() => {
      expect(document.body.textContent).toContain('disclaimer:ai_generated');
    });
  });
});
