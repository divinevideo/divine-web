import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CollabsPage } from './CollabsPage';

const { mockCurrentUser, mockOpenLoginDialog } = vi.hoisted(() => ({
  mockCurrentUser: vi.fn<() => { user: { pubkey: string } | null }>(() => ({ user: { pubkey: 'a'.repeat(64) } })),
  mockOpenLoginDialog: vi.fn(),
}));

vi.mock('@/components/collabs/InboxTab', () => ({ InboxTab: () => <div>INBOX</div> }));
vi.mock('@/components/collabs/InviteTab', () => ({ InviteTab: () => <div>INVITE</div> }));
vi.mock('@/components/collabs/ConfirmedTab', () => ({ ConfirmedTab: () => <div>CONFIRMED</div> }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser(),
}));
vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({ openLoginDialog: mockOpenLoginDialog }),
}));

// Note: We do NOT use TestApp as a wrapper here because TestApp mounts a BrowserRouter,
// and React Router does not support nested routers. MemoryRouter alone is sufficient
// for routing tests; the collabs tab components are mocked so no providers are needed.
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/collabs" element={<CollabsPage />} />
        <Route path="/collabs/:tab" element={<CollabsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CollabsPage', () => {
  beforeEach(() => {
    mockCurrentUser.mockReturnValue({ user: { pubkey: 'a'.repeat(64) } });
    mockOpenLoginDialog.mockReset();
  });

  it.each([
    ['/collabs',           'INBOX'],
    ['/collabs/inbox',     'INBOX'],
    ['/collabs/invite',    'INVITE'],
    ['/collabs/confirmed', 'CONFIRMED'],
  ])('renders the right tab for %s', (path, expected) => {
    renderAt(path);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('asks logged-out visitors to sign in instead of rendering loading tabs', async () => {
    mockCurrentUser.mockReturnValue({ user: null });

    renderAt('/collabs/invite');

    expect(screen.queryByText('INVITE')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign in to manage collabs/i }));
    expect(mockOpenLoginDialog).toHaveBeenCalledTimes(1);
  });
});
