// ABOUTME: Hook for logged-out users to submit content reports
// ABOUTME: Creates Zendesk tickets without publishing Nostr events

import { useMutation } from '@tanstack/react-query';
import { submitReportToZendesk, buildContentUrl } from '@/lib/reportApi';
import type { ContentFilterReason } from '@/types/moderation';

interface AnonymousReportParams {
  email: string;
  eventId?: string;
  pubkey?: string;
  contentType: 'video' | 'user' | 'comment';
  reason: ContentFilterReason;
  details?: string;
}

export function useAnonymousReport() {
  return useMutation({
    mutationFn: async (params: AnonymousReportParams) => {
      if (!params.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email)) {
        throw new Error('A valid email is required for anonymous reports');
      }

      if (!params.eventId && !params.pubkey) {
        throw new Error('Must provide either eventId or pubkey');
      }

      return submitReportToZendesk({
        reporterEmail: params.email,
        eventId: params.eventId,
        pubkey: params.pubkey,
        contentType: params.contentType,
        reason: params.reason,
        details: params.details,
        contentUrl: buildContentUrl(params.eventId, params.pubkey),
        timestamp: Date.now(),
      });
    },
  });
}
