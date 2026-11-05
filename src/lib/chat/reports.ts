// ABOUTME: Room reports reuse the signed-in account and bind NIP-98 auth to exact JSON bytes.
import type { CommunitySigner } from './communityRelay';
import { sha256Hex } from './protocol';
export async function submitRoomReport(endpoint: string, signer: CommunitySigner,
  target: { communityId: string; channelId: string; rumorId: string }, reason: string,
  request: typeof fetch = fetch, signal?: AbortSignal): Promise<string> {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.pathname !== '/v1/reports' || url.hash || url.search) throw new Error('Invalid report destination');
  if (!Object.values(target).every(value => /^[0-9a-f]{64}$/.test(value)) || !reason.trim() || reason.length > 2048) throw new Error('Invalid room report');
  const body = JSON.stringify({ target, reason: reason.trim() });
  signal?.throwIfAborted();
  const event = await signer.signEvent({ kind: 27235, content: '', created_at: Math.floor(Date.now() / 1000), tags: [['u', url.href], ['method', 'POST'], ['payload', sha256Hex(body)]] });
  signal?.throwIfAborted();
  const response = await request(url.href, { method: 'POST', headers: { Authorization: `Nostr ${btoa(JSON.stringify(event))}`, 'Content-Type': 'application/json' }, body, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
  if (response.status !== 202) throw new Error('Report was not accepted');
  const result = await response.json() as { caseId?: string };
  if (typeof result.caseId !== 'string' || !result.caseId) throw new Error('Report confirmation is missing');
  return result.caseId;
}
