import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, verifyEvent } from 'nostr-tools';
import { submitRoomReport } from './reports';
import { sha256Hex } from './protocol';
describe('signed room reports', () => {
  it('binds existing-account authentication to the exact target and request bytes', async () => {
    const sk = generateSecretKey();
    let called = false;
    const target = { communityId: 'a'.repeat(64), channelId: 'b'.repeat(64), rumorId: 'c'.repeat(64) };
    const result = await submitRoomReport('https://reports.example/v1/reports', { signEvent: async t => finalizeEvent(t, sk) }, target, 'spam', async (url, options) => {
      called = true;
      const event = JSON.parse(atob(String((options?.headers as Record<string, string>).Authorization).slice(6)));
      expect(verifyEvent(event)).toBe(true);
      expect(event.kind).toBe(27235);
      expect(event.tags).toContainEqual(['u', url]);
      expect(event.tags).toContainEqual(['method', 'POST']);
      expect(event.tags).toContainEqual(['payload', sha256Hex(String(options?.body))]);
      expect(JSON.parse(String(options?.body))).toEqual({ target, reason: 'spam' });
      return new Response(JSON.stringify({ caseId: 'case-1' }), { status: 202 });
    });
    expect(called).toBe(true); expect(result).toBe('case-1');
  });
});

it('does not submit a report after its account session is aborted during signing', async () => {
  const controller = new AbortController(); const sk = generateSecretKey();
  let requested = false;
  const target = { communityId: 'a'.repeat(64), channelId: 'b'.repeat(64), rumorId: 'c'.repeat(64) };
  await expect(submitRoomReport('https://reports.example/v1/reports', { signEvent: async template => {
    controller.abort(); return finalizeEvent(template, sk);
  } }, target, 'spam', async () => { requested = true; return new Response(); }, controller.signal)).rejects.toThrow();
  expect(requested).toBe(false);
});
