/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ChatPage from './ChatPage';

vi.mock('@/hooks/useChatSession', () => ({
  useChatSession: () => ({ isLoggedIn: false, isResolvingJwt: false, user: undefined, signer: undefined, store: null }),
}));

vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: () => <button type="button">Log in</button>,
}));

describe('ChatPage', () => {
  it('gives a logged-out visitor a login control on invite links, which render outside the app layout', () => {
    render(
      <MemoryRouter initialEntries={['/invite/naddr1xyz']}>
        <Routes>
          <Route path="/invite/:code" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});
