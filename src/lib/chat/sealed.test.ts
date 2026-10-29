/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { describe, expect, it } from 'vitest';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import { groupKeyHex, hexToBytes, messageRumor, openWrap, sealRumor, wrapSeal } from './protocol';

const ALICE = 'bad6726ee37fe895587b4b99f2d0712f0fde4e9e45fa8ad16d4c4d6c6b570c27';
const COMMUNITY_ROOT = '35a93a8c43f063aaeb500e2f92338904fdc6cf7900eec4bbae7522b9d0bab943';
const CHANNEL_ID = 'dd13d19e60c43496ca80c5f1ec6c33cbf8202e57e3bc969ad28e94598e91e15a';

describe('sealed envelope plane (1059/20013)', () => {
  it('seals, wraps, and opens with author/id binding verification', async () => {
    const stream = groupKeyHex('concord/channel', COMMUNITY_ROOT, CHANNEL_ID, 0);
    const author = getPublicKey(hexToBytes(ALICE));
    const rumor = messageRumor({ author, channelId: CHANNEL_ID, epoch: 0, body: 'sealed hello', createdAt: 1700000000, ms: 42 });
    const sign = async (t: { kind: number; content: string; tags: string[][]; created_at: number }) => finalizeEvent(t, hexToBytes(ALICE));
    const seal = await sealRumor(rumor, 20013, stream, sign);
    expect(seal.kind).toBe(20013);
    expect(seal.pubkey).toBe(author);
    const wrap = wrapSeal(seal, stream);
    expect(wrap.kind).toBe(1059);
    expect(wrap.pubkey).toBe(stream.pubkey);
    const opened = openWrap(wrap as never, stream);
    expect(opened.rumorId).toBe(rumor.id);
    expect(opened.author).toBe(author);
    expect(opened.content).toBe('sealed hello');
    // tampered wrap author rejected
    expect(() => openWrap({ ...wrap, pubkey: author } as never, stream)).toThrow();
    // plaintext seal plane also opens
    const seal2 = await sealRumor(rumor, 20014, stream, sign);
    expect(openWrap(wrapSeal(seal2, stream) as never, stream).content).toBe('sealed hello');
  });
});
