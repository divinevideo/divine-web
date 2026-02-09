// ABOUTME: Hooks for content moderation using NIP-51 mute lists and NIP-56 reporting
// ABOUTME: Manages user's mute list, content filtering, and reporting

import { useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import {
  MuteType,
  type MuteItem,
  type ContentReport,
  ContentFilterReason,
  type ModerationResult,
  ContentSeverity
} from '@/types/moderation';
import { submitReportToZendesk, buildContentUrl } from '@/lib/reportApi';

// Stable empty array to prevent infinite re-renders when user is not logged in
const EMPTY_MUTE_LIST: MuteItem[] = [];

/**
 * Parse a mute list event (kind 10001)
 */
function parseMuteList(event: NostrEvent): MuteItem[] {
  const items: MuteItem[] = [];

  for (const tag of event.tags) {
    const [type, value, reason] = tag;

    // Check if it's a valid mute type
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
 * Hook to fetch user's mute list
 */
export function useMuteList(pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const targetPubkey = pubkey || user?.pubkey;

  return useQuery({
    queryKey: ['mute-list', targetPubkey],
    queryFn: async (context) => {
      if (!targetPubkey) {
        console.log('[useMuteList] No target pubkey, returning empty list');
        return [];
      }

      console.log('[useMuteList] Fetching mute list for:', targetPubkey);

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000)
      ]);

      const filter: NostrFilter = {
        kinds: [10001], // Mute list
        authors: [targetPubkey],
        limit: 1
      };

      const events = await nostr.query([filter], { signal });

      console.log('[useMuteList] Found', events.length, 'mute list events');

      if (events.length === 0) return [];

      // Get the most recent mute list
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      console.log('[useMuteList] Latest mute list event:', latestEvent);

      const items = parseMuteList(latestEvent);
      console.log('[useMuteList] Parsed', items.length, 'mute items:', items);

      return items;
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
  const { mutate: publishEvent } = useNostrPublish();
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

      // Fetch current mute list
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [10001],
        authors: [user.pubkey],
        limit: 1
      }], { signal });

      // Get existing items
      let existingItems: MuteItem[] = [];
      if (events.length > 0) {
        existingItems = parseMuteList(events[0]);
      }

      // Check if already muted
      const alreadyMuted = existingItems.some(
        item => item.type === type && item.value === value
      );

      if (alreadyMuted) {
        return; // Already in mute list
      }

      // Build tags with new item
      const tags: string[][] = [];

      // Add existing items
      existingItems.forEach(item => {
        const tag = [item.type, item.value];
        if (item.reason) tag.push(item.reason);
        tags.push(tag);
      });

      // Add new item
      const newTag = [type, value];
      if (reason) newTag.push(reason);
      tags.push(newTag);

      await publishEvent({
        kind: 10001,
        content: '',
        tags
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
  const { mutate: publishEvent } = useNostrPublish();
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

      // Fetch current mute list
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [10001],
        authors: [user.pubkey],
        limit: 1
      }], { signal });

      if (events.length === 0) {
        return; // No mute list exists
      }

      const existingItems = parseMuteList(events[0]);

      // Filter out the item to unmute
      const updatedItems = existingItems.filter(
        item => !(item.type === type && item.value === value)
      );

      // Build tags
      const tags: string[][] = updatedItems.map(item => {
        const tag = [item.type, item.value];
        if (item.reason) tag.push(item.reason);
        return tag;
      });

      await publishEvent({
        kind: 10001,
        content: '',
        tags
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mute-list'] });
    }
  });
}

/**
 * Hook to report content (NIP-56)
 */
export function useReportContent() {
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      eventId,
      pubkey,
      reason,
      details,
      contentType = 'video'
    }: {
      eventId?: string;
      pubkey?: string;
      reason: ContentFilterReason;
      details?: string;
      contentType?: 'video' | 'user' | 'comment';
    }) => {
      if (!user) throw new Error('Must be logged in to report content');

      const tags: string[][] = [];

      // Add reported event or pubkey
      if (eventId) {
        tags.push(['e', eventId, reason]);
      }
      if (pubkey) {
        tags.push(['p', pubkey, reason]);
      }

      // Add label namespace (NIP-32)
      tags.push(['L', 'social.nos.ontology']);
      tags.push(['l', `NS-${reason}`, 'social.nos.ontology']);

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

  // Debug: Log mute list when it changes
  console.log('[useContentModeration] Mute list loaded:', muteList.length, 'items', muteList);

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
        console.log('[useContentModeration] MATCHED muted user:', content.pubkey, mutedUser);
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
        console.log('[useContentModeration] MATCHED muted event:', content.eventId);
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
          console.log('[useContentModeration] MATCHED muted hashtag:', hashtag);
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
          console.log('[useContentModeration] MATCHED muted keyword:', keyword.value);
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
