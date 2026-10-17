/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { describe, expect, it } from 'vitest';
import { encodeInviteFragment } from './protocol';
import { consumeInvite, parseInviteUrl, peekInvite, stashInvite } from './invite';
describe('chat routes / invite deep link', () => {
  it('spec invite link: naddr in path, token only in fragment, stashed client-side', () => {
    const frag = encodeInviteFragment('00112233445566778899aabbccddeeff');
    const invite = parseInviteUrl('/invite/naddr1xyz', '#' + frag);
    expect(invite?.naddr).toBe('naddr1xyz');
    expect(invite?.tokenHex).toBe('00112233445566778899aabbccddeeff');
    stashInvite(invite!);
    expect(consumeInvite()?.tokenHex).toBe('00112233445566778899aabbccddeeff');
    expect(consumeInvite()).toBeNull(); // consumed once; refresh does not replay
  });
  it('peeking a token-only invite leaves it stashed for the bundle fetch', () => {
    stashInvite({ tokenHex: '00112233445566778899aabbccddeeff', naddr: 'naddr1xyz' });
    expect(peekInvite()?.naddr).toBe('naddr1xyz');
    expect(peekInvite()?.tokenHex).toBe('00112233445566778899aabbccddeeff');
    consumeInvite();
  });
});
