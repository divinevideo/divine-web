import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import { InviteApiError } from '@/lib/inviteApi';
import InvitesLandingPage from './InvitesLandingPage';

const { mockValidateInviteCode, mockNavigate, mockCurrentUser } = vi.hoisted(() => ({
  mockValidateInviteCode: vi.fn(),
  mockNavigate: vi.fn(),
  mockCurrentUser: { user: null as { pubkey: string } | null },
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser,
}));

vi.mock('@/lib/inviteApi', () => ({
  validateInviteCode: mockValidateInviteCode,
  InviteApiError: class InviteApiError extends Error {
    code: 'invalid_invite' | 'unavailable' | 'unknown';
    status: number;
    inviteStatus?: string;
    constructor(message: string, code: 'invalid_invite' | 'unavailable' | 'unknown', status: number, inviteStatus?: string) {
      super(message);
      this.name = 'InviteApiError';
      this.code = code;
      this.status = status;
      this.inviteStatus = inviteStatus;
    }
  },
}));

vi.mock('@unhead/react', () => ({
  useHead: () => undefined,
  useSeoMeta: () => undefined,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/invite/:code" element={<InvitesLandingPage />} />
        <Route path="/home" element={<div data-testid="home-page">Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InvitesLandingPage', () => {
  beforeEach(async () => {
    mockValidateInviteCode.mockReset();
    mockNavigate.mockReset();
    mockCurrentUser.user = null;

    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
    });

    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('shows the heading and pre-fills the code from the URL when the API confirms it is valid', async () => {
    mockValidateInviteCode.mockResolvedValue({ valid: true, normalizedCode: 'ABCD-1234' });

    renderAt('/invite/ABCD-1234');

    expect(screen.getByRole('heading', { name: "You're Invited!" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Invite code')).toHaveValue('ABCD-1234');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a specific used-code message when the API returns status: "used"', async () => {
    mockValidateInviteCode.mockRejectedValue(
      new InviteApiError('Invite already claimed', 'invalid_invite', 400, 'used'),
    );

    renderAt('/invite/ZHV5-HECU');

    await waitFor(() => {
      expect(screen.getByText('This invite code has already been used')).toBeInTheDocument();
    });
  });

  it('falls back to the generic error message for codes the API marks as invalid', async () => {
    mockValidateInviteCode.mockRejectedValue(
      new InviteApiError('Invite not found', 'invalid_invite', 400, 'invalid'),
    );

    renderAt('/invite/NOTREAL-9999');

    await waitFor(() => {
      expect(screen.getByText('Unable to validate invite code')).toBeInTheDocument();
    });
  });

  it('navigates to /home when the visitor is already logged in', async () => {
    mockCurrentUser.user = { pubkey: 'a'.repeat(64) };
    mockValidateInviteCode.mockResolvedValue({ valid: true, normalizedCode: 'ABCD-1234' });

    renderAt('/invite/ABCD-1234');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
    });
    expect(mockValidateInviteCode).not.toHaveBeenCalled();
  });
});
