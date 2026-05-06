// ABOUTME: API client for submitting content and bug reports to Zendesk via /api/report
// ABOUTME: Used by authenticated and anonymous flows on the web client

export interface ReportPayload {
  reporterPubkey?: string;
  reporterName?: string;
  reporterEmail?: string;
  eventId?: string;
  pubkey?: string;
  contentType: 'video' | 'user' | 'comment';
  reason: string;
  details?: string;
  contentUrl?: string;
  timestamp: number;
}

export interface BugReportPayload {
  reportType: 'bug';
  subject: string;
  description: string;
  timestamp: number;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  pageUrl?: string;
  userAgent?: string;
  appVersion?: string;
  osVersion?: string;
  logsSummary?: string;
  reporterPubkey?: string;
  reporterName?: string;
  reporterEmail?: string;
}

export interface ReportResponse {
  success: boolean;
  ticketId?: number;
  error?: string;
}

const LOCAL_REPORT_API_HINT =
  'Report API endpoint was not found. In local dev, run `npm run fastly:local` (Fastly serves /api/report on 127.0.0.1:7676 by default) or set VITE_REPORT_API_TARGET.';

async function readReportResponse(
  response: Response,
  fallbackError: string,
): Promise<ReportResponse> {
  const raw = await response.text();

  let data: ReportResponse = { success: false };
  if (raw.trim()) {
    try {
      data = JSON.parse(raw) as ReportResponse;
    } catch {
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(LOCAL_REPORT_API_HINT);
        }

        throw new Error(`${fallbackError} (received non-JSON ${response.status} response)`);
      }

      throw new Error('Report API returned an invalid JSON response');
    }
  }

  if (!response.ok) {
    if (data.error) {
      throw new Error(data.error);
    }

    if (response.status === 404) {
      throw new Error(LOCAL_REPORT_API_HINT);
    }

    throw new Error(`${fallbackError} (${response.status})`);
  }

  return data;
}

export async function submitReportToZendesk(payload: ReportPayload): Promise<ReportResponse> {
  const response = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return readReportResponse(response, 'Failed to submit report');
}

export async function submitBugReportToZendesk(payload: BugReportPayload): Promise<ReportResponse> {
  const response = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return readReportResponse(response, 'Failed to submit bug report');
}

export function buildContentUrl(eventId?: string, pubkey?: string): string | undefined {
  const base = window.location.origin;
  if (eventId) return `${base}/video/${eventId}`;
  if (pubkey) return `${base}/profile/${pubkey}`;
  return undefined;
}
