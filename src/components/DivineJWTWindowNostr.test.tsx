// ABOUTME: Tests for DivineJWTWindowNostr component
// ABOUTME: Verifies component integration and window.nostr injection

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { DivineJWTWindowNostr } from './DivineJWTWindowNostr';
import { removeWindowNostr } from '@/lib/bunkerToWindowNostr';

// Mock the hooks
vi.mock('@/hooks/useDivineSession', () => ({
  useDivineSession: vi.fn(() => ({
    getValidToken: vi.fn(() => 'mock-token'),
  })),
}));

vi.mock('@/hooks/useWindowNostrJWT', () => ({
  useWindowNostrJWT: vi.fn(({ token }) => ({
    signer: token
      ? {
          getPublicKey: vi.fn().mockResolvedValue('a'.repeat(64)),
          signEvent: vi.fn(),
        }
      : null,
    isInitializing: false,
    error: null,
    isInjected: !!token,
    inject: vi.fn(),
    remove: vi.fn(),
    updateToken: vi.fn(),
  })),
}));

describe('DivineJWTWindowNostr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeWindowNostr();
  });

  it('should render without crashing', () => {
    const { container } = render(<DivineJWTWindowNostr />);
    expect(container).toBeDefined();
  });

  it('should not render any visible content', () => {
    const { container } = render(<DivineJWTWindowNostr />);
    expect(container.textContent).toBe('');
  });

  it('should render with verbose prop', () => {
    const { container } = render(<DivineJWTWindowNostr verbose={true} />);
    expect(container).toBeDefined();
  });

  it('should call useDivineSession to get token', async () => {
    const { useDivineSession } = await import('@/hooks/useDivineSession');
    render(<DivineJWTWindowNostr />);
    expect(useDivineSession).toHaveBeenCalled();
  });

  it('should call useWindowNostrJWT with token', async () => {
    const { useWindowNostrJWT } = await import('@/hooks/useWindowNostrJWT');
    render(<DivineJWTWindowNostr />);
    expect(useWindowNostrJWT).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'mock-token',
        autoInject: true,
      })
    );
  });

  it('should handle case when no token is available', async () => {
    const { useDivineSession } = await import('@/hooks/useDivineSession');
    (useDivineSession as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      getValidToken: vi.fn(() => null),
    });

    const { container } = render(<DivineJWTWindowNostr />);
    expect(container).toBeDefined();
  });
});
