import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
