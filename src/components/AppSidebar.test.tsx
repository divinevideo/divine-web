import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from './AppSidebar';

const { mockNavigate, mockSetTheme } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSetTheme: vi.fn(),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ data: [] }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ displayTheme: 'light', setTheme: mockSetTheme }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useUnreadNotificationCount: () => ({ data: 0 }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: false }),
  useUnreadDmCount: () => ({ data: 0 }),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useSubdomainUser', () => ({
  getSubdomainUser: () => null,
}));

vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: () => <div data-testid="login-area" />,
}));

vi.mock('@/hooks/useRssFeedAvailable', () => ({
  useRssFeedAvailable: () => false,
}));

vi.mock('@/hooks/usePlatformStats', () => ({
  usePlatformStats: () => ({ data: undefined }),
}));

describe('AppSidebar', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetTheme.mockReset();
  });

  it('renders a Copyright & DMCA legal action', () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /terms & open source/i }));

    const dmcaButton = screen.getByRole('button', { name: 'Copyright & DMCA' });
    expect(dmcaButton).toBeVisible();

    fireEvent.click(dmcaButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dmca');
  });
});
