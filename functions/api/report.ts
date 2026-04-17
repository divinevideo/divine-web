// ABOUTME: Cloudflare Pages Function to create Zendesk tickets for content and bug reports
// ABOUTME: Mirrors compute-js/src/index.js handleReport (Fastly) for preview deployments

interface Env {
  ZENDESK_SUBDOMAIN: string;
  ZENDESK_API_EMAIL: string;
  ZENDESK_API_TOKEN: string;
}

/** Sync with divine-mobile ZendeskSupportService.createStructuredBugReport */
const ZD_BUG_FORM_ID = 14772963437071;
const ZD_FIELD_TICKET_TYPE = 14332953477519;
const ZD_FIELD_PLATFORM = 14884176561807;
const ZD_FIELD_OS_VERSION = 14884157556111;
const ZD_FIELD_BUILD = 14884184890511;
const ZD_FIELD_STEPS = 14677364166031;
const ZD_FIELD_EXPECTED = 14677341431695;

const ALLOWED_ORIGINS = [
  'https://divine.video',
  'https://www.divine.video',
  'https://staging.divine.video',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8080',
  'https://localhost:8080',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.divine-web-fm8\.pages\.dev$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function getPriority(reason: string): 'urgent' | 'high' | 'normal' {
  switch (reason) {
    case 'csam':
    case 'illegal':
      return 'urgent';
    case 'violence':
    case 'harassment':
    case 'impersonation':
      return 'high';
    default:
      return 'normal';
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function reportBuildNumberFromAppVersion(appVersion: string | undefined): string {
  if (!appVersion || typeof appVersion !== 'string') return 'unknown';
  const plus = appVersion.indexOf('+');
  return plus >= 0 ? appVersion.slice(plus + 1) : appVersion;
}

function buildBugReportCommentBody(
  effectiveSubject: string,
  description: string,
  meta: {
    appVersion: string;
    stepsToReproduce: string;
    expectedBehavior: string;
    pageUrl: string;
    userAgent: string;
    logsSummary: string;
  },
): string {
  const lines = [effectiveSubject, '', description, '', `App Version: ${meta.appVersion || 'unknown'}`, ''];
  if (meta.stepsToReproduce) {
    lines.push('### Steps to Reproduce', meta.stepsToReproduce, '');
  }
  if (meta.expectedBehavior) {
    lines.push('### Expected Behavior', meta.expectedBehavior, '');
  }
  lines.push('### Environment');
  lines.push(`- **Page URL:** ${meta.pageUrl || 'n/a'}`);
  lines.push(`- **User-Agent:** ${meta.userAgent || 'n/a'}`);
  if (meta.logsSummary.trim()) {
    lines.push('', '### Recent Logs', '```', meta.logsSummary.trim(), '```');
  }
  return lines.join('\n');
}

interface ReportJson {
  reportType?: string;
  contentType?: string;
  reason?: string;
  timestamp?: number;
  eventId?: string;
  pubkey?: string;
  reporterPubkey?: string;
  reporterName?: string;
  reporterEmail?: string;
  details?: string;
  contentUrl?: string;
  subject?: string;
  description?: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  pageUrl?: string;
  userAgent?: string;
  appVersion?: string;
  osVersion?: string;
  logsSummary?: string;
}

function resolveRequester(
  body: ReportJson,
  corsHeaders: Record<string, string>,
): { ok: true; requesterEmail: string; isAuthenticated: boolean } | { ok: false; response: Response } {
  if (body.reporterPubkey) {
    return {
      ok: true,
      requesterEmail: `${body.reporterPubkey}@reports.divine.video`,
      isAuthenticated: true,
    };
  }
  if (body.reporterEmail) {
    if (!isValidEmail(body.reporterEmail)) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: 'Invalid email format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }),
      };
    }
    return { ok: true, requesterEmail: body.reporterEmail, isAuthenticated: false };
  }
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: 'Must provide either reporterPubkey or reporterEmail' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }),
  };
}

async function postZendesk(
  ticket: Record<string, unknown>,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const zendeskUrl = `https://${env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets.json`;
  const auth = btoa(`${env.ZENDESK_API_EMAIL}/token:${env.ZENDESK_API_TOKEN}`);

  try {
    const response = await fetch(zendeskUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({ ticket }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zendesk API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to create ticket' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const data = (await response.json()) as { ticket: { id: number } };
    return new Response(JSON.stringify({ success: true, ticketId: data.ticket.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Zendesk API request failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to connect to ticket system' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function onRequestOptions(context: { request: Request }): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const corsHeaders = getCorsHeaders(context.request);
  const origin = context.request.headers.get('Origin') || '';
  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { ZENDESK_SUBDOMAIN, ZENDESK_API_EMAIL, ZENDESK_API_TOKEN } = context.env;
  if (!ZENDESK_SUBDOMAIN || !ZENDESK_API_EMAIL || !ZENDESK_API_TOKEN) {
    console.error('Missing Zendesk configuration environment variables');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let body: ReportJson;
  try {
    body = (await context.request.json()) as ReportJson;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const reportType = typeof body.reportType === 'string' ? body.reportType : '';
  const looksLikeContent = Boolean(
    body.contentType && body.reason != null && body.timestamp != null,
  );
  const isBug = reportType === 'bug';
  const isContent = reportType === 'content' || (!isBug && looksLikeContent);

  if (isBug) {
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!subject || !description || body.timestamp == null) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: subject, description, timestamp',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const who = resolveRequester(body, corsHeaders);
    if (!who.ok) return who.response;

    const reporterName = body.reporterName || body.reporterPubkey || body.reporterEmail;
    const appVersion = typeof body.appVersion === 'string' ? body.appVersion : 'unknown';
    const osVersion =
      typeof body.osVersion === 'string' && body.osVersion.trim()
        ? body.osVersion.trim()
        : 'web';

    const stepsToReproduce = typeof body.stepsToReproduce === 'string' ? body.stepsToReproduce.trim() : '';
    const expectedBehavior = typeof body.expectedBehavior === 'string' ? body.expectedBehavior.trim() : '';

    const customFields: { id: number; value: string }[] = [
      { id: ZD_FIELD_TICKET_TYPE, value: 'incident' },
      { id: ZD_FIELD_PLATFORM, value: 'web' },
      { id: ZD_FIELD_OS_VERSION, value: osVersion },
      { id: ZD_FIELD_BUILD, value: reportBuildNumberFromAppVersion(appVersion) },
    ];
    if (stepsToReproduce) customFields.push({ id: ZD_FIELD_STEPS, value: stepsToReproduce });
    if (expectedBehavior) customFields.push({ id: ZD_FIELD_EXPECTED, value: expectedBehavior });

    const meta = {
      appVersion,
      stepsToReproduce,
      expectedBehavior,
      pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : '',
      userAgent: typeof body.userAgent === 'string' ? body.userAgent : '',
      logsSummary: typeof body.logsSummary === 'string' ? body.logsSummary : '',
    };

    const effectiveSubject = subject || 'Bug report (divine-web)';
    const commentBody = buildBugReportCommentBody(effectiveSubject, description, meta);

    const requester: Record<string, string> = {
      email: who.requesterEmail,
      name: typeof reporterName === 'string' ? reporterName : who.requesterEmail,
    };
    if (body.reporterPubkey) {
      requester.external_id = body.reporterPubkey;
    }

    const ticket = {
      subject: effectiveSubject,
      comment: { body: commentBody },
      requester,
      ticket_form_id: ZD_BUG_FORM_ID,
      custom_fields: customFields,
      tags: ['bug_report', 'divine_app', 'web', 'client-divine-web'],
      priority: 'normal' as const,
    };

    return postZendesk(ticket, context.env, corsHeaders);
  }

  if (!isContent) {
    return new Response(JSON.stringify({
      error: 'Unknown report: set reportType to "bug" or send contentType, reason, and timestamp',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!body.contentType || !body.reason || body.timestamp == null) {
    return new Response(JSON.stringify({ error: 'Missing required fields: contentType, reason, timestamp' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!body.eventId && !body.pubkey) {
    return new Response(JSON.stringify({ error: 'Must provide either eventId or pubkey' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const who = resolveRequester(body, corsHeaders);
  if (!who.ok) return who.response;

  const subject = `[Content Report] ${body.reason} - ${body.contentType}`;
  const tags = [
    'content-report',
    'client-divine-web',
    'nip-56',
    'web',
    `reason-${body.reason}`,
    `type-${body.contentType}`,
    who.isAuthenticated ? 'authenticated' : 'anonymous',
  ];

  const bodyParts: string[] = [
    `**Content Type:** ${body.contentType}`,
    `**Reason:** ${body.reason}`,
  ];
  if (body.eventId) bodyParts.push(`**Event ID:** ${body.eventId}`);
  if (body.pubkey) bodyParts.push(`**Reported Pubkey:** ${body.pubkey}`);
  if (body.contentUrl) bodyParts.push(`**Content URL:** ${body.contentUrl}`);
  if (body.details) bodyParts.push(`\n**Details:**\n${body.details}`);
  bodyParts.push(`\n**Reported at:** ${new Date(body.timestamp).toISOString()}`);
  bodyParts.push(
    `**Reporter:** ${who.isAuthenticated ? `Authenticated user (${body.reporterPubkey})` : `Anonymous (${body.reporterEmail})`}`,
  );
  bodyParts.push('\n---');
  bodyParts.push('Reported via Divine web (NIP-56 content report).');

  const requester: Record<string, string> = {
    email: who.requesterEmail,
    name: body.reporterName || body.reporterPubkey || body.reporterEmail || who.requesterEmail,
  };
  if (body.reporterPubkey) {
    requester.external_id = body.reporterPubkey;
  }

  const ticket = {
    subject,
    comment: { body: bodyParts.join('\n') },
    requester,
    tags,
    priority: getPriority(body.reason),
  };

  return postZendesk(ticket, context.env, corsHeaders);
}
