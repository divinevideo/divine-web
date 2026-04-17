import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18n } from '@/lib/i18n';

import { LoginArea } from './LoginArea';

const mockCloseLoginDialog = vi.fn();

vi.mock('@/hooks/useLoggedInAccounts', () => ({
  useLoggedInAccounts: () => ({
    currentUser: null,
  }),
}));

vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({
    closeLoginDialog: mockCloseLoginDialog,
    isOpen: false,
  }),
}));

vi.mock('./LoginDialog', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Invite Login Dialog</div> : null),
}));

describe('LoginArea', () => {
  beforeEach(async () => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('opens only the invite-first login dialog from the public entry point', async () => {
    const user = userEvent.setup();

    render(<LoginArea />);

    expect(screen.queryByRole('button', { name: /Join Waitlist/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Get Early Access/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Log in/i }));

    expect(screen.getByText('Invite Login Dialog')).toBeInTheDocument();
  });
});
