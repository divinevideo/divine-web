/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// Pinned generator: node scripts/generate-concord-fixtures.mjs — deterministic, TEST-ONLY identities.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const derive = (ns, ...p) => sha(['concord:v1', ns, ...p].join(':'));
const SEED = 'concord-test-seed-v1';
const alice = sha(`${SEED}:alice`), bob = sha(`${SEED}:bob`);
const communityId = derive('community', alice, 'test-community');
const channelId = derive('channel', communityId, 'general');
const fixture = {
  version: 1, seed: SEED, note: 'TEST-ONLY synthetic identities; never real keys. Dart side consumes this same JSON.',
  identities: { alice: { secret: alice, pubkey: sha(`pubkey:${alice}`) }, bob: { secret: bob, pubkey: sha(`pubkey:${bob}`) } },
  derivations: { communityId, channelId, streamId: derive('stream', communityId, channelId), threadId: derive('thread', channelId, 'root-1') },
  sha256Vectors: [{ input: 'abc', expected: sha('abc') }, { input: '', expected: sha('') }],
  payloads: { message: { type: 'message', id: derive('msg', channelId, 'seed-1', 'hello'), channelId, body: 'hello' } },
  expiry: { stampedAt: 1000, ttlSeconds: 300, exp: 1300, expiredAt: 1300 },
  controlFold: {
    owner: sha(`pubkey:${alice}`),
    events: [{ seq: 1, actor: sha(`pubkey:${alice}`), authorityEventId: 'evt-1', action: { kind: 'ban', pubkey: sha(`pubkey:${bob}`) } }],
    expectedBans: [sha(`pubkey:${bob}`)],
  },
  communityList33302: { communityId, channelIds: [channelId], unknownField: 'preserve-me' },
};
writeFileSync(new URL('../test-fixtures/concord/v1/fixtures.json', import.meta.url), JSON.stringify(fixture, null, 2) + '\n');
console.log('wrote fixtures', communityId);
