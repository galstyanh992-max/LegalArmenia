import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockResetPasswordForEmail = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
type AuthListener = (event: string, session: unknown) => void;
let authListeners: AuthListener[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      onAuthStateChange: (cb: AuthListener) => {
        authListeners.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));

import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const renderForgot = () =>
  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    </MemoryRouter>
  );

const renderReset = () =>
  render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div data-testid="login-page" />} />
        <Route path="/forgot-password" element={<div data-testid="forgot-page" />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  authListeners = [];
  window.location.hash = '';
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockResetPasswordForEmail.mockResolvedValue({ error: null });
  mockUpdateUser.mockResolvedValue({ data: {}, error: null });
  mockSignOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  window.location.hash = '';
});

// ── Recovery request ─────────────────────────────────────────────────────────

describe('ForgotPassword', () => {
  it('rejects an invalid email without calling the API', async () => {
    renderForgot();

    fireEvent.input(screen.getByPlaceholderText('example@mail.com'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /Ուղարկել հղումը/ }));

    await waitFor(() => {
      expect(screen.getByText('Մուտքագրեք վավեր էլ․ հասցե')).toBeInTheDocument();
    });
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sends the recovery request with a redirect to /reset-password and shows a generic confirmation', async () => {
    renderForgot();

    fireEvent.input(screen.getByPlaceholderText('example@mail.com'), { target: { value: 'client@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Ուղարկել հղումը/ }));

    await waitFor(() => {
      expect(screen.getByTestId('recovery-request-submitted')).toBeInTheDocument();
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
    const [email, options] = mockResetPasswordForEmail.mock.calls[0] as [
      string,
      { redirectTo: string },
    ];
    expect(email).toBe('client@example.com');
    expect(options.redirectTo).toMatch(/\/reset-password$/);
  });

  it('stays on the form when the API reports an error (no enumeration leak)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'rate limited' } });
    renderForgot();

    fireEvent.input(screen.getByPlaceholderText('example@mail.com'), { target: { value: 'client@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Ուղարկել հղումը/ }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('recovery-request-submitted')).not.toBeInTheDocument();
  });
});

// ── Recovery callback and password update ────────────────────────────────────

describe('ResetPassword', () => {
  it('shows the invalid-link state when there is no recovery session and no token', async () => {
    renderReset();

    await waitFor(() => {
      expect(screen.getByTestId('recovery-link-invalid')).toBeInTheDocument();
    });
    expect(screen.getByText(/անվավեր է կամ արդեն օգտագործվել/)).toBeInTheDocument();
  });

  it('shows the expired state when the URL carries otp_expired', async () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired&error_description=x';
    renderReset();

    await waitFor(() => {
      expect(screen.getByTestId('recovery-link-invalid')).toBeInTheDocument();
    });
    expect(screen.getByText(/ժամկետը լրացել է/)).toBeInTheDocument();
  });

  it('renders the password form when a recovery session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    renderReset();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Թարմացնել գաղտնաբառը/ })).toBeInTheDocument();
    });
  });

  it('validates minimum length and confirmation match', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    renderReset();

    const submit = await screen.findByRole('button', { name: /Թարմացնել գաղտնաբառը/ });
    const [passwordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');

    fireEvent.input(passwordInput, { target: { value: 'short' } });
    fireEvent.input(confirmInput, { target: { value: 'short' } });
    fireEvent.click(submit);
    await waitFor(() => {
      expect(screen.getByText(/առնվազն 8 նիշ/)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();

    fireEvent.input(passwordInput, { target: { value: '' } });
    fireEvent.input(confirmInput, { target: { value: '' } });
    fireEvent.input(passwordInput, { target: { value: 'longenough1' } });
    fireEvent.input(confirmInput, { target: { value: 'different1' } });
    fireEvent.click(submit);
    await waitFor(() => {
      expect(screen.getByText(/չեն համընկնում/)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('updates the password, signs out the recovery session, and redirects to login', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    renderReset();

    const submit = await screen.findByRole('button', { name: /Թարմացնել գաղտնաբառը/ });
    const [passwordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');

    fireEvent.input(passwordInput, { target: { value: 'new-password-1' } });
    fireEvent.input(confirmInput, { target: { value: 'new-password-1' } });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-password-1' });
    });
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('keeps the form visible and does not sign out when the update fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockUpdateUser.mockResolvedValue({ data: null, error: { message: 'weak password' } });
    renderReset();

    const submit = await screen.findByRole('button', { name: /Թարմացնել գաղտնաբառը/ });
    const [passwordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');

    fireEvent.input(passwordInput, { target: { value: 'new-password-1' } });
    fireEvent.input(confirmInput, { target: { value: 'new-password-1' } });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled();
    });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Թարմացնել գաղտնաբառը/ })).toBeInTheDocument();
  });
});
