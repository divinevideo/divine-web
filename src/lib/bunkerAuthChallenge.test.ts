// ABOUTME: Tests for NIP-46 auth challenge presentation
// ABOUTME: divine-web#485 — challenges must open a tab, with a link fallback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { presentAuthChallenge } from './bunkerAuthChallenge';

describe('presentAuthChallenge', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('opens the challenge in a new tab', () => {
    const result = presentAuthChallenge('https://signer.example/auth?token=abc');

    expect(openSpy).toHaveBeenCalledWith('https://signer.example/auth?token=abc', '_blank');
    expect(result).toEqual({ url: 'https://signer.example/auth?token=abc', opened: true });
  });

  // Regression guard. `window.open` returns null whenever the feature string
  // sets `noopener`, and `noreferrer` implies `noopener`. Passing either makes
  // `opened` permanently false in real browsers, so the dialog claims the popup
  // was blocked every single time. The jsdom mock cannot reproduce that, so
  // pin the call shape instead.
  it('opens without noopener/noreferrer so the return value stays meaningful', () => {
    presentAuthChallenge('https://signer.example/auth');

    const features = openSpy.mock.calls[0][2];
    expect(features).toBeUndefined();
  });

  it('severs the opener reference on the tab it opened', () => {
    const popup = {} as Window;
    openSpy.mockReturnValue(popup);

    presentAuthChallenge('https://signer.example/auth');

    expect(popup.opener).toBeNull();
  });

  it('reports the URL for a link fallback when the popup is blocked', () => {
    openSpy.mockReturnValue(null);

    const result = presentAuthChallenge('https://signer.example/auth');

    expect(result).toEqual({ url: 'https://signer.example/auth', opened: false });
  });

  it('accepts http as well as https', () => {
    expect(presentAuthChallenge('http://localhost:8080/auth').opened).toBe(true);
  });

  // The URL arrives from the remote signer over the wire. Handing an arbitrary
  // scheme to window.open would let a hostile signer trigger javascript: or
  // data: navigation in the user's browser.
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'chrome://settings',
  ])('refuses to open %s', (hostile) => {
    const result = presentAuthChallenge(hostile);

    expect(openSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ url: null, opened: false });
  });

  it('refuses unparseable input', () => {
    expect(presentAuthChallenge('not a url')).toEqual({ url: null, opened: false });
    expect(presentAuthChallenge('')).toEqual({ url: null, opened: false });
    expect(openSpy).not.toHaveBeenCalled();
  });
});
