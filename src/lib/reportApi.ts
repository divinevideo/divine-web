// ABOUTME: API client for submitting content reports to Zendesk
// ABOUTME: Used by both authenticated and anonymous report flows

export interface ReportPayload {
  reporterPubkey?: string;
  reporterEmail?: string;
  eventId?: string;
  pubkey?: string;
  contentType: 'video' | 'user' | 'comment';
  reason: string;
  details?: string;
  contentUrl?: string;
  timestamp: number;
}

export interface ReportResponse {
  success: boolean;
  ticketId?: number;
  error?: string;
}

export async function submitReportToZendesk(payload: ReportPayload): Promise<ReportResponse> {
  const response = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json() as ReportResponse;

  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit report');
  }

  return data;
}

export function buildContentUrl(eventId?: string, pubkey?: string): string | undefined {
  const base = window.location.origin;
  if (eventId) return `${base}/video/${eventId}`;
  if (pubkey) return `${base}/profile/${pubkey}`;
  return undefined;
}
