import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CollabsPage } from './CollabsPage';

vi.mock('@/components/collabs/InboxTab', () => ({ InboxTab: () => <div>INBOX</div> }));
vi.mock('@/components/collabs/InviteTab', () => ({ InviteTab: () => <div>INVITE</div> }));
vi.mock('@/components/collabs/ConfirmedTab', () => ({ ConfirmedTab: () => <div>CONFIRMED</div> }));

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
  it.each([
    ['/collabs',           'INBOX'],
    ['/collabs/inbox',     'INBOX'],
    ['/collabs/invite',    'INVITE'],
    ['/collabs/confirmed', 'CONFIRMED'],
  ])('renders the right tab for %s', (path, expected) => {
    renderAt(path);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
