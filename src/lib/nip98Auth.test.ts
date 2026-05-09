import { createHash } from 'node:crypto';
import type { NostrSigner } from '@nostrify/nostrify';
import { describe, expect, it, vi } from 'vitest';

import { createNip98AuthHeader } from './nip98Auth';

const TEST_PUBKEY = 'a'.repeat(64);
const TEST_ID = 'b'.repeat(64);
const TEST_SIG = 'c'.repeat(128);

function decodeHeader(header: string) {
  const encoded = header.replace(/^Nostr /, '');
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}

describe('createNip98AuthHeader', () => {
  it('omits the payload tag for GET requests without a body', async () => {
    const signer = {
      signEvent: vi.fn(async (event) => ({
        ...event,
        pubkey: TEST_PUBKEY,
        id: TEST_ID,
        sig: TEST_SIG,
      })),
    } as unknown as NostrSigner;

    const header = await createNip98AuthHeader(
      signer,
      'https://relay.divine.video/api/users/pubkey/notifications?limit=1',
      'GET',
    );

    expect(header).toBeTruthy();

    const event = decodeHeader(header!);
    expect(event.tags).toContainEqual([
      'u',
      'https://relay.divine.video/api/users/pubkey/notifications?limit=1',
    ]);
    expect(event.tags).toContainEqual(['method', 'GET']);
    expect(event.tags.some((tag: string[]) => tag[0] === 'payload')).toBe(false);
  });

  it('includes a payload hash for POST requests with a body', async () => {
    const signer = {
      signEvent: vi.fn(async (event) => ({
        ...event,
        pubkey: TEST_PUBKEY,
        id: TEST_ID,
        sig: TEST_SIG,
      })),
    } as unknown as NostrSigner;
    const body = JSON.stringify({ notification_ids: ['event-1'] });

    const header = await createNip98AuthHeader(
      signer,
      'https://relay.divine.video/api/users/pubkey/notifications/read',
      'POST',
      body,
    );

    expect(header).toBeTruthy();

    const event = decodeHeader(header!);
    expect(event.tags).toContainEqual([
      'payload',
      createHash('sha256').update(body).digest('hex'),
    ]);
  });
});
