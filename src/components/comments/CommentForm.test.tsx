import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import { CommentForm } from './CommentForm';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/usePostComment', () => ({
  usePostComment: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: () => <div data-testid="login-area" />,
}));

describe('CommentForm', () => {
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

    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('renders the sign-in prompt in the active locale', () => {
    render(<CommentForm root={new URL('https://example.com/comments')} />);

    expect(screen.getByText('Inicia sesion para comentar')).toBeInTheDocument();
  });
});
