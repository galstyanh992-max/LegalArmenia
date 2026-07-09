import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CaseForm } from './CaseForm';

// Mock Supabase client (not exercised on mount, but imported at module load).
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn(), getSession: vi.fn() },
    storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) },
    functions: { invoke: vi.fn() },
  },
}));

// Mock i18n: return the key verbatim so we can assert on the disclaimer key.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabase-functions-url', () => ({
  getFunctionUrl: vi.fn(() => 'https://example.com/extract-case-form-fields'),
}));

describe('CaseForm autofill AI disclaimer', () => {
  it('renders the AI disclaimer in the autofill section for new cases', () => {
    render(
      <CaseForm
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        initialData={null}
        isLoading={false}
      />
    );
    expect(document.body.textContent).toContain('disclaimer:ai_warning');
  });
});
