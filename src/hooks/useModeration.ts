// ABOUTME: Hooks for content moderation using NIP-51 mute lists (kind 10000) and NIP-56 reporting
// ABOUTME: Manages user's mute list, content filtering, and reporting

import { useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import {
  MUTE_LIST_KIND,
  MuteType,
  type MuteItem,
  type ContentReport,
  ContentFilterReason,
  type ModerationResult,
  ContentSeverity
} from '@/types/moderation';
import {
  clearWebMute,
  getRememberedOwnMuteList,
  getWebMutedPubkeys,
  recordWebMute,
  rememberOwnMuteList,
  type RememberedOwnMuteList,
} from '@/lib/moderationProvenance';
import { submitReportToZendesk, buildContentUrl } from '@/lib/reportApi';

// Canonical definition lives in @/types/moderation so pure modules can read the
// kind without importing this hook module. Re-exported for existing callers.
export { MUTE_LIST_KIND };

// Stable empty array to prevent infinite re-renders when user is not logged in
const EMPTY_MUTE_LIST: MuteItem[] = [];

type PublishEvent = ReturnType<typeof useNostrPublish>['mutateAsync'];
type NostrClient = ReturnType<typeof useNostr>['nostr'];

export class MuteListUnavailableError extends Error {
  constructor() {
    super('Could not load your moderation list. Please try again in a moment.');
    this.name = 'MuteListUnavailableError';
  }
}

/**
 * The tags/content web will build the next kind 10000 publish from. It comes
 * either from the latest relay copy or from the remembered own snapshot, so
 * callers never have to care which one won.
 */
interface MuteListBase {
  tags: string[][];
  content: string;
  createdAt: number;
}

/**
 * Parse the mute-relevant tags from a NIP-51 mute list (kind 10000).
 * Returns only p/t/word/e tags the UI understands. Other tags (a pins, d, etc.)
 * are preserved on the base itself and must round-trip through the mutation
 * helpers below.
 *
 * `webMutedPubkeys` carries local provenance: a user entry web recorded is
 * `web`, anything else is `unknown` and may be a Block another client set.
 */
function parseMuteList(base: MuteListBase, webMutedPubkeys: Set<string> = new Set()): MuteItem[] {
  const items: MuteItem[] = [];

  for (const tag of base.tags) {
    const [type, value, reason] = tag;

    if (type === 'p' || type === 't' || type === 'word' || type === 'e') {
      if (value) {
        items.push({
          type: type as MuteType,
          value,
          reason,
          createdAt: base.createdAt,
          origin: type === MuteType.USER && webMutedPubkeys.has(value)
            ? 'web'
            : 'unknown'
        });
      }
    }
  }

  return items;
}

/**
 * Return the most recent event from a Nostr relay response, or null.
 * NIP-01: newest `created_at` wins. On a tie, the lowest event id wins
 * so relays deterministically converge on one canonical copy.
 */
function latestEvent(events: NostrEvent[]): NostrEvent | null {
  if (events.length === 0) return null;
  return events
    .slice()
    .sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1))[0];
}

function rememberEvent(ownerPubkey: string, event: NostrEvent): void {
  rememberOwnMuteList(ownerPubkey, {
    createdAt: event.created_at,
    tags: event.tags,
    content: event.content,
    eventId: event.id,
  });
}

function snapshotToBase(snapshot: RememberedOwnMuteList): MuteListBase {
  return {
    tags: snapshot.tags.map(tag => [...tag]),
    content: snapshot.content,
    createdAt: snapshot.createdAt,
  };
}

function eventToBase(event: NostrEvent): MuteListBase {
  return {
    tags: event.tags,
    content: event.content,
    createdAt: event.created_at,
  };
}

/**
 * Pick the mute list web should trust for the owner.
 *
 * Relays can miss the list entirely or answer with an older copy. Either would
 * make the next publish drop entries the user still has muted or blocked, so
 * the remembered own snapshot wins whenever it is newer. It is a
 * lost-state guard, not a safety boundary: the newest copy always wins, and a
 * snapshot is only ever consulted for the viewer's own list.
 */
function resolveMuteListBase(
  events: NostrEvent[],
  ownerPubkey: string,
  canUseOwnSnapshot: boolean,
): MuteListBase | null {
  const latest = latestEvent(events);
  const remembered = canUseOwnSnapshot ? getRememberedOwnMuteList(ownerPubkey) : null;

  if (!latest) {
    return remembered ? snapshotToBase(remembered) : null;
  }

  if (remembered && remembered.createdAt > latest.created_at) {
    return snapshotToBase(remembered);
  }

  if (canUseOwnSnapshot) {
    rememberEvent(ownerPubkey, latest);
  }
  return eventToBase(latest);
}

/**
 * Read the owner's mute list for a mutation. Throws rather than returning an
 * empty list when the relay never reached EOSE, so a mutation never republishes
 * from state that was merely never established.
 */
async function fetchMuteListForPublish(
  nostr: NostrClient,
  userPubkey: string,
): Promise<MuteListBase | null> {
  const signal = AbortSignal.timeout(5000);
  const events: NostrEvent[] = [];
  let relayQuerySucceeded = false;

  try {
    for await (const message of nostr.req([{
      kinds: [MUTE_LIST_KIND],
      authors: [userPubkey],
      limit: 1
    }], { signal })) {
      if (message[0] === 'EVENT' && message[2].kind === MUTE_LIST_KIND) {
        events.push(message[2]);
      } else if (message[0] === 'EOSE') {
        relayQuerySucceeded = true;
        break;
      } else if (message[0] === 'CLOSED') {
        break;
      }
    }
  } catch {
    throw new MuteListUnavailableError();
  }

  if (!relayQuerySucceeded || signal.aborted) {
    throw new MuteListUnavailableError();
  }

  return resolveMuteListBase(events, userPubkey, true);
}

export async function publishMuteListUpdate({
  nostr,
  publishEvent,
  userPubkey,
  updateTags,
}: {
  nostr: NostrClient;
  publishEvent: PublishEvent;
  userPubkey: string;
  updateTags: (current: { tags: string[][]; items: MuteItem[] }) => string[][] | null;
}): Promise<boolean> {
  const base = await fetchMuteListForPublish(nostr, userPubkey);
  const existingTags: string[][] = base ? base.tags : [];
  const existingContent = base ? base.content : '';
  const existingItems = base ? parseMuteList(base, getWebMutedPubkeys(userPubkey)) : [];
  const tags = updateTags({ tags: existingTags, items: existingItems });
  if (!tags) return false;

  const published = await publishEvent({
    kind: MUTE_LIST_KIND,
    content: existingContent,
    tags
  });
  rememberEvent(userPubkey, published);
  return true;
}

/**
 * Hook to fetch user's mute list
 */
export function useMuteList(pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const targetPubkey = pubkey || user?.pubkey;
  // Provenance and the remembered snapshot are local to the signed-in viewer,
  // so they only apply when the list being read is that viewer's own.
  const canUseOwnSnapshot = !!user?.pubkey && targetPubkey === user.pubkey;

  return useQuery({
    queryKey: ['mute-list', targetPubkey],
    queryFn: async (context) => {
      if (!targetPubkey) return [];

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000)
      ]);

      const filter: NostrFilter = {
        kinds: [MUTE_LIST_KIND], // NIP-51 mute list
        authors: [targetPubkey],
        limit: 1
      };

      const events = await nostr.query([filter], { signal });

      const base = resolveMuteListBase(events, targetPubkey, canUseOwnSnapshot);
      if (!base) return [];

      const webMutedPubkeys = canUseOwnSnapshot
        ? getWebMutedPubkeys(targetPubkey)
        : new Set<string>();
      return parseMuteList(base, webMutedPubkeys);
    },
    enabled: !!targetPubkey,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}

/**
 * Hook to add item to mute list
 */
export function useMuteItem() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      type,
      value,
      reason
    }: {
      type: MuteType;
      value: string;
      reason?: string;
    }) => {
      if (!user) throw new Error('Must be logged in to mute content');

      const didPublish = await publishMuteListUpdate({
        nostr,
        publishEvent,
        userPubkey: user.pubkey,
        updateTags: ({ tags, items }) => {
          const alreadyMuted = items.some(
            item => item.type === type && item.value === value
          );
          if (alreadyMuted) return null;

          const newTag = [type, value];
          if (reason) newTag.push(reason);
          return [...tags, newTag];
        },
      });

      // Only claim provenance for a p-tag web actually added. An entry that was
      // already on the list came from somewhere else and keeps its `unknown`
      // origin, so unmuting it still warns the user.
      if (didPublish && type === MuteType.USER) {
        recordWebMute(user.pubkey, value);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mute-list'] });
    }
  });
}

/**
 * Hook to remove item from mute list
 */
export function useUnmuteItem() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      type,
      value
    }: {
      type: MuteType;
      value: string;
    }) => {
      if (!user) throw new Error('Must be logged in to unmute content');

      await publishMuteListUpdate({
        nostr,
        publishEvent,
        userPubkey: user.pubkey,
        updateTags: ({ tags, items }) => {
          const hasItem = items.some(item => item.type === type && item.value === value);
          if (!hasItem) return null;
          return tags.filter(tag => !(tag[0] === type && tag[1] === value));
        },
      });

      // Clear provenance unconditionally: the p-tag is gone from the list
      // either way, so a stale `web` claim would only mislabel a future entry.
      if (type === MuteType.USER) {
        clearWebMute(user.pubkey, value);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mute-list'] });
    }
  });
}

/**
 * Map app-level ContentFilterReason to one of the NIP-56 standard report type
 * strings: nudity, malware, profanity, illegal, spam, impersonation, other.
 * Aligned with mobile's _toNip56ReportType in content_reporting_service.dart.
 */
export function toNip56ReportType(reason: ContentFilterReason): string {
  switch (reason) {
    case ContentFilterReason.SPAM: return 'spam';
    // NIP-56 has no harassment category; profanity is the closest fit per mobile alignment
    case ContentFilterReason.HARASSMENT: return 'profanity';
    // Violence escalates to illegal per platform policy (aligned with mobile)
    case ContentFilterReason.VIOLENCE: return 'illegal';
    case ContentFilterReason.SEXUAL_CONTENT: return 'nudity';
    case ContentFilterReason.COPYRIGHT: return 'illegal';
    case ContentFilterReason.FALSE_INFO: return 'other';
    case ContentFilterReason.CHILD_SAFETY: return 'other';
    // CSAM is a subset of illegal content in NIP-56's taxonomy
    case ContentFilterReason.CSAM: return 'illegal';
    case ContentFilterReason.UNDERAGE_USER: return 'other';
    case ContentFilterReason.AI_GENERATED: return 'other';
    case ContentFilterReason.IMPERSONATION: return 'impersonation';
    case ContentFilterReason.ILLEGAL: return 'illegal';
    case ContentFilterReason.OTHER: return 'other';
  }
}

/**
 * Map app-level ContentFilterReason to the NIP-32 label value used by
 * downstream moderation UIs (social.nos.ontology namespace).
 * Aligned with mobile's _toNip32ReportLabel in content_reporting_service.dart.
 */
export function toNip32ReportLabel(reason: ContentFilterReason): string {
  switch (reason) {
    case ContentFilterReason.SPAM: return 'NS-spam';
    case ContentFilterReason.HARASSMENT: return 'NS-harassment';
    case ContentFilterReason.VIOLENCE: return 'NS-violence';
    case ContentFilterReason.SEXUAL_CONTENT: return 'NS-sexualContent';
    case ContentFilterReason.COPYRIGHT: return 'NS-copyright';
    case ContentFilterReason.FALSE_INFO: return 'NS-falseInformation';
    case ContentFilterReason.CHILD_SAFETY: return 'NS-childSafety';
    case ContentFilterReason.CSAM: return 'NS-csam';
    case ContentFilterReason.UNDERAGE_USER: return 'NS-underageUser';
    case ContentFilterReason.AI_GENERATED: return 'NS-aiGenerated';
    case ContentFilterReason.IMPERSONATION: return 'NS-impersonation';
    case ContentFilterReason.ILLEGAL: return 'NS-illegal';
    case ContentFilterReason.OTHER: return 'NS-other';
  }
}

/**
 * Hook to report content (NIP-56)
 */
export function useReportContent() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      eventId,
      pubkey,
      reason,
      details,
      contentType = 'video',
      reporterName,
    }: {
      eventId?: string;
      pubkey: string;
      reason: ContentFilterReason;
      details?: string;
      contentType?: 'video' | 'user' | 'comment';
      reporterName?: string;
    }) => {
      if (!user) throw new Error('Must be logged in to report content');

      // NIP-56: p tag is required for all kind:1984 reports
      const tags: string[][] = [];

      const nip56Type = toNip56ReportType(reason);
      const nip32Label = toNip32ReportLabel(reason);

      // NIP-56: always include p for the reported user
      tags.push(['p', pubkey, nip56Type]);

      // Include e when reporting a specific note or comment
      if (eventId) {
        tags.push(['e', eventId, nip56Type]);
      }

      // Add label namespace (NIP-32)
      tags.push(['L', 'social.nos.ontology']);
      tags.push(['l', nip32Label, 'social.nos.ontology']);

      // Identify report source for trusted reporter gating
      tags.push(['client', 'divine-web']);

      await publishEvent({
        kind: 1984, // Reporting event
        content: details || `Reporting ${reason}`,
        tags
      });

      // Fire-and-forget Zendesk ticket creation
      submitReportToZendesk({
        reporterPubkey: user.pubkey,
        reporterName,
        eventId,
        pubkey,
        contentType,
        reason,
        details,
        contentUrl: buildContentUrl(eventId, pubkey),
        timestamp: Date.now(),
      }).catch((err) => {
        console.warn('[useReportContent] Zendesk ticket creation failed:', err);
      });

      // Store report locally for user history
      const report: ContentReport = {
        reportId: `report_${Date.now()}`,
        eventId,
        pubkey,
        reason,
        details: details || '',
        createdAt: Math.floor(Date.now() / 1000)
      };

      // Store in localStorage
      const existing = localStorage.getItem('content_reports');
      const reports: ContentReport[] = existing ? JSON.parse(existing) : [];
      reports.push(report);
      // Keep only last 100 reports
      const trimmed = reports.slice(-100);
      localStorage.setItem('content_reports', JSON.stringify(trimmed));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-reports'] });
    }
  });
}

/**
 * Hook to get user's report history
 */
export function useReportHistory() {
  return useQuery({
    queryKey: ['content-reports'],
    queryFn: () => {
      const stored = localStorage.getItem('content_reports');
      if (!stored) return [];
      return JSON.parse(stored) as ContentReport[];
    },
    staleTime: Infinity
  });
}

/**
 * Hook to check if content should be filtered
 */
export function useContentModeration() {
  const { data: muteList = EMPTY_MUTE_LIST } = useMuteList();

  const checkContent = useCallback((content: {
    pubkey?: string;
    eventId?: string;
    hashtags?: string[];
    text?: string;
  }): ModerationResult => {
    const matchingItems: MuteItem[] = [];
    const reasons: ContentFilterReason[] = [];

    // Check if user is muted
    if (content.pubkey) {
      const mutedUser = muteList.find(
        item => item.type === MuteType.USER && item.value === content.pubkey
      );
      if (mutedUser) {
        matchingItems.push(mutedUser);
        reasons.push(ContentFilterReason.OTHER);
      }
    }

    // Check if event is muted
    if (content.eventId) {
      const mutedEvent = muteList.find(
        item => item.type === MuteType.EVENT && item.value === content.eventId
      );
      if (mutedEvent) {
        matchingItems.push(mutedEvent);
        reasons.push(ContentFilterReason.OTHER);
      }
    }

    // Check hashtags
    if (content.hashtags) {
      for (const hashtag of content.hashtags) {
        const mutedHashtag = muteList.find(
          item => item.type === MuteType.HASHTAG &&
                  item.value.toLowerCase() === hashtag.toLowerCase()
        );
        if (mutedHashtag) {
          matchingItems.push(mutedHashtag);
          reasons.push(ContentFilterReason.OTHER);
        }
      }
    }

    // Check keywords in text
    if (content.text) {
      const keywords = muteList.filter(item => item.type === MuteType.KEYWORD);
      const lowerText = content.text.toLowerCase();

      for (const keyword of keywords) {
        if (lowerText.includes(keyword.value.toLowerCase())) {
          matchingItems.push(keyword);
          reasons.push(ContentFilterReason.OTHER);
        }
      }
    }

    const shouldFilter = matchingItems.length > 0;
    const severity = shouldFilter ? ContentSeverity.HIDE : ContentSeverity.INFO;

    return {
      shouldFilter,
      severity,
      reasons: Array.from(new Set(reasons)),
      matchingItems,
      warningMessage: shouldFilter
        ? `Content filtered: ${matchingItems.map(i => i.reason || 'muted').join(', ')}`
        : undefined
    };
  }, [muteList]);

  const isMuted = useCallback((pubkey: string) => {
    return muteList.some(
      item => item.type === MuteType.USER && item.value === pubkey
    );
  }, [muteList]);

  return {
    muteList,
    checkContent,
    isMuted
  };
}
