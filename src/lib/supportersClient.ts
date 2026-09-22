import type { NostrSigner } from '@nostrify/nostrify';
import { z } from 'zod';

import { createNip98AuthHeader } from '@/lib/nip98Auth';

const SUPPORTERS_URL = 'https://supporters.divine.video';
const recognitionSchema = z.object({
  haloVisible: z.boolean(), discoveryVisible: z.boolean(), foundingHistoryVisible: z.boolean(),
});
const snapshotSchema = z.object({
  status: z.enum(['active', 'grace', 'expired', 'unknown']),
  entitlement: z.object({ isActive: z.boolean() }),
  recognition: recognitionSchema,
});
export type SupporterSnapshot = z.infer<typeof snapshotSchema>;
export type SupporterRecognition = z.infer<typeof recognitionSchema>;

async function supporterRequest(signer: NostrSigner, expectedPubkey: string, path: string, method: string, body?: string, signal?: AbortSignal) {
  const url = `${SUPPORTERS_URL}${path}`;
  const authorization = await createNip98AuthHeader(signer, url, method, body);
  if (!authorization) throw new Error('Supporter authentication failed');
  const signedEvent = JSON.parse(atob(authorization.slice('Nostr '.length))) as { pubkey?: string };
  if (signedEvent.pubkey !== expectedPubkey) throw new Error('Signer account changed');
  signal?.throwIfAborted();
  const response = await fetch(url, {
    method, body, signal, redirect: 'error', cache: 'no-store',
    headers: { Authorization: authorization, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!response.ok) throw new Error('Supporter request failed');
  return snapshotSchema.parse(await response.json());
}

export function fetchSupporter(signer: NostrSigner, pubkey: string, signal?: AbortSignal) {
  return supporterRequest(signer, pubkey, '/v1/me', 'GET', undefined, signal);
}

export function updateSupporterRecognition(signer: NostrSigner, pubkey: string, recognition: SupporterRecognition) {
  return supporterRequest(signer, pubkey, '/v1/me/recognition', 'PATCH', JSON.stringify({
    halo_visible: recognition.haloVisible,
    discovery_visible: recognition.discoveryVisible,
    founding_history_visible: recognition.foundingHistoryVisible,
  }));
}

export async function fetchPublicSupporter(pubkey: string, signal?: AbortSignal): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(pubkey)) throw new Error('Invalid supporter public key');
  const response = await fetch(`${SUPPORTERS_URL}/v1/public/supporters?pubkeys=${pubkey}`, {
    signal, cache: 'no-store', redirect: 'error',
  });
  if (!response.ok) throw new Error('Public supporter request failed');
  const data = z.object({ supporters: z.array(z.object({ pubkey: z.string(), haloVisible: z.literal(true) })) }).parse(await response.json());
  return data.supporters.some(supporter => supporter.pubkey === pubkey);
}
