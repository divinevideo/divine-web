import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubdomainNavigate } from './useSubdomainNavigate';

const {
  mockGetSubdomainAwareUrl,
  mockLocationReplace,
  mockNavigate,
} = vi.hoisted(() => ({
  mockGetSubdomainAwareUrl: vi.fn(),
  mockLocationReplace: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/subdomainLinks', () => ({
  getSubdomainAwareUrl: mockGetSubdomainAwareUrl,
}));

const originalLocation = window.location;

describe('useSubdomainNavigate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        href: 'https://alice.divine.video/start',
        replace: mockLocationReplace,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('replaces browser history for external navigation with replace', () => {
    mockGetSubdomainAwareUrl.mockReturnValue({
      href: 'https://divine.video/messages/support',
      isExternal: true,
    });
    const { result } = renderHook(() => useSubdomainNavigate());

    act(() => {
      result.current('/messages/support', { replace: true });
    });

    expect(mockGetSubdomainAwareUrl).toHaveBeenCalledWith('/messages/support', undefined);
    expect(mockLocationReplace).toHaveBeenCalledWith('https://divine.video/messages/support');
    expect(window.location.href).toBe('https://alice.divine.video/start');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('assigns href for external navigation without replace', () => {
    mockGetSubdomainAwareUrl.mockReturnValue({
      href: 'https://divine.video/discovery',
      isExternal: true,
    });
    const { result } = renderHook(() => useSubdomainNavigate());

    act(() => {
      result.current('/discovery');
    });

    expect(window.location.href).toBe('https://divine.video/discovery');
    expect(mockLocationReplace).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('uses client routing and omits ownerPubkey from navigation options', () => {
    mockGetSubdomainAwareUrl.mockReturnValue({
      href: '/profile/npub1owner',
      isExternal: false,
    });
    const { result } = renderHook(() => useSubdomainNavigate());

    act(() => {
      result.current('/profile/npub1owner', {
        ownerPubkey: 'owner-pubkey',
        replace: true,
        state: { source: 'test' },
      });
    });

    expect(mockGetSubdomainAwareUrl).toHaveBeenCalledWith(
      '/profile/npub1owner',
      'owner-pubkey',
    );
    expect(mockNavigate).toHaveBeenCalledWith('/profile/npub1owner', {
      replace: true,
      state: { source: 'test' },
    });
    expect(mockLocationReplace).not.toHaveBeenCalled();
  });

  it('passes numeric navigation directly to React Router', () => {
    const { result } = renderHook(() => useSubdomainNavigate());

    act(() => {
      result.current(-1);
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
    expect(mockGetSubdomainAwareUrl).not.toHaveBeenCalled();
    expect(mockLocationReplace).not.toHaveBeenCalled();
  });
});
