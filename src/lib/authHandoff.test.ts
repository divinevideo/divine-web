import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearInviteHandoff,
  readInviteHandoff,
  setInviteHandoff,
} from './authHandoff';

const originalLocation = window.location;
const originalCookieDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie')
  ?? Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;

let cookieJar = '';

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname },
    writable: true,
    configurable: true,
  });
}

describe('authHandoff', () => {
  beforeEach(() => {
    cookieJar = '';
    Object.defineProperty(document, 'cookie', {
      get: () => cookieJar,
      set: (value: string) => {
        if (value.includes('max-age=0')) {
          const name = value.split('=')[0];
          cookieJar = cookieJar
            .split('; ')
            .filter((entry) => entry && !entry.startsWith(`${name}=`))
            .join('; ');
          return;
        }

        const name = value.split('=')[0];
        const entries = cookieJar
          .split('; ')
          .filter((entry) => entry && !entry.startsWith(`${name}=`));
        entries.push(value.split(';')[0]);
        cookieJar = entries.join('; ');
      },
      configurable: true,
    });

    setHostname('divine.video');
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'cookie', originalCookieDescriptor);
  });

  it('persists and reads the short-lived invite handoff cookie', () => {
    setInviteHandoff({
      code: 'abcd-efgh',
      mode: 'signup',
      createdAt: 1_700_000_000_000,
      returnPath: '/messages',
    });

    expect(readInviteHandoff(1_700_000_000_000 + 60_000)).toEqual({
      code: 'ABCD-EFGH',
      mode: 'signup',
      createdAt: 1_700_000_000_000,
      returnPath: '/messages',
    });
  });

  it('returns null after the handoff expires', () => {
    setInviteHandoff({
      code: 'ABCD-EFGH',
      mode: 'signup',
      createdAt: 1_700_000_000_000,
    });

    expect(readInviteHandoff(1_700_000_000_000 + 11 * 60_000)).toBeNull();
  });

  it('clears the invite handoff cookie', () => {
    setInviteHandoff({
      code: 'ABCD-EFGH',
      mode: 'signup',
      createdAt: 1_700_000_000_000,
    });

    clearInviteHandoff();

    expect(readInviteHandoff()).toBeNull();
  });
});
