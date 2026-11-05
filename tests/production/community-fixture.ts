import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

export const fixture = JSON.parse(readFileSync(new URL('../../test-fixtures/concord/community-interop.json', import.meta.url), 'utf8')) as typeof import('../../test-fixtures/concord/community-interop.json');

export const otherFixture = JSON.parse(readFileSync(new URL('../../test-fixtures/concord/community-lifecycle.json', import.meta.url), 'utf8')) as typeof import('../../test-fixtures/concord/community-lifecycle.json');

export async function prepareCommunityFixture(page: Page, baseURL: string, tamperBundle = false) {
  const secret = generateSecretKey(); const pubkey = getPublicKey(secret);
  const account = { id: `nsec:${pubkey}`, type: 'nsec', pubkey, createdAt: new Date().toISOString(), data: { nsec: nip19.nsecEncode(secret) } };
  await page.addInitScript(login => {
    localStorage.setItem('nostr:login', JSON.stringify([login]));
    localStorage.setItem('divine:locale', 'en');
  }, account);
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.routeWebSocket('**/*', socket => {
    socket.onMessage(raw => {
      const frame = JSON.parse(String(raw));
      if (frame[0] === 'REQ') {
        const events = [{ ...fixture.bundleEvent, ...(tamperBundle ? { sig: '0'.repeat(128) } : {}) }, ...fixture.controlEvents, fixture.chatEvent, otherFixture.bundleEvent, ...otherFixture.controlEvents];
        for (const event of events) if (frame.slice(2).some((filter: { kinds?: number[]; authors?: string[] }) =>
          (!filter.kinds || filter.kinds.includes(event.kind)) && (!filter.authors || filter.authors.includes(event.pubkey)))) {
          socket.send(JSON.stringify(['EVENT', frame[1], event]));
        }
        socket.send(JSON.stringify(['EOSE', frame[1]]));
      }
      if (frame[0] === 'EVENT') socket.send(JSON.stringify(['OK', frame[1].id, true, 'synthetic fixture only']));
    });
  });
}
