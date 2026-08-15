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
import { submitReportToZendesk, buildContentUrl } from '@/lib/reportApi';

// Canonical definition lives in @/types/moderation so pure modules can read the
// kind without importing this hook module. Re-exported for existing callers.
export { MUTE_LIST_KIND };

// Stable empty array to prevent infinite re-renders when user is not logged in
const EMPTY_MUTE_LIST: MuteItem[] = [];

type PublishEvent = ReturnType<typeof useNostrPublish>['mutateAsync'];
type NostrClient = ReturnType<typeof useNostr>['nostr'];

/**
 * Parse the mute-relevant tags from a NIP-51 mute list event (kind 10000).
 * Returns only p/t/word/e tags the UI understands. Other tags (a pins, d, etc.)
 * are preserved on the event itself and must round-trip through the mutation
 * helpers below.
 */
function parseMuteList(event: NostrEvent): MuteItem[] {
  const items: MuteItem[] = [];

  for (const tag of event.tags) {
    const [type, value, reason] = tag;

    if (type === 'p' || type === 't' || type === 'word' || type === 'e') {
      if (value) {
        items.push({
          type: type as MuteType,
          value,
          reason,
          createdAt: event.created_at
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
}): Promise<void> {
  const signal = AbortSignal.timeout(5000);
  const events = await nostr.query([{
    kinds: [MUTE_LIST_KIND],
    authors: [userPubkey],
    limit: 1
  }], { signal });

  const latest = latestEvent(events);
  const existingTags: string[][] = latest ? latest.tags : [];
  const existingContent = latest ? latest.content : '';
  const existingItems = latest ? parseMuteList(latest) : [];
  const tags = updateTags({ tags: existingTags, items: existingItems });
  if (!tags) return;

  await publishEvent({
    kind: MUTE_LIST_KIND,
    content: existingContent,
    tags
  });
}

/**
 * Hook to fetch user's mute list
 */
export function useMuteList(pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const targetPubkey = pubkey || user?.pubkey;

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

      const latest = latestEvent(events);
      if (!latest) return [];

      return parseMuteList(latest);
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

      await publishMuteListUpdate({
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
