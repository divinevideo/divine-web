import type { NostrEvent } from '@nostrify/nostrify';

import { PRIMARY_RELAY } from '@/config/relays';
import { LIST_KINDS } from '@/lib/listEventDeletions';

interface Publisher {
  event: (event: NostrEvent, opts?: { relays?: string[]; signal?: AbortSignal }) => Promise<void>;
}

export function isListPublication(event: Pick<NostrEvent, 'kind' | 'tags'>): boolean {
  return LIST_KINDS.includes(event.kind) || (event.kind === 5 && event.tags.some(([name, target]) => (
    (name === 'k' && LIST_KINDS.includes(Number(target))) ||
    (name === 'a' && LIST_KINDS.some(kind => target?.startsWith(`${kind}:`)))
  )));
}

export async function publishListToPrimary(nostr: Publisher, event: NostrEvent): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await nostr.event(event, {
        relays: [PRIMARY_RELAY.url],
        signal: AbortSignal.timeout(5000),
      });
      return;
    } catch (error) {
      const causes = error instanceof Error && 'errors' in error && Array.isArray(error.errors) ? error.errors : [error];
      const permanent = causes.length > 0 && causes.every(cause => (
        cause instanceof Error && /^(invalid|blocked|restricted|auth-required|pow):/i.test(cause.message)
      ));
      if (attempt === 2 || permanent) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}
