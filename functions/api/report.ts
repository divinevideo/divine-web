// ABOUTME: Cloudflare Pages Function to create Zendesk tickets for content reports
// ABOUTME: Handles both authenticated (pubkey) and anonymous (email) reports

interface Env {
  ZENDESK_SUBDOMAIN: string;
  ZENDESK_API_EMAIL: string;
  ZENDESK_API_TOKEN: string;
}

interface ReportRequest {
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

const ALLOWED_ORIGINS = [
  'https://divine.video',
  'https://www.divine.video',
  'https://staging.divine.video',
  'http://localhost:5173',
  'http://localhost:4173',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow Cloudflare Pages preview deployments
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

  // Validate origin
  const origin = context.request.headers.get('Origin') || '';
  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Validate env vars
  const { ZENDESK_SUBDOMAIN, ZENDESK_API_EMAIL, ZENDESK_API_TOKEN } = context.env;
  if (!ZENDESK_SUBDOMAIN || !ZENDESK_API_EMAIL || !ZENDESK_API_TOKEN) {
    console.error('Missing Zendesk configuration environment variables');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let body: ReportRequest;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Validate required fields
  if (!body.contentType || !body.reason || !body.timestamp) {
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

  // Determine requester email
  let requesterEmail: string;
  let isAuthenticated: boolean;

  if (body.reporterPubkey) {
    requesterEmail = `${body.reporterPubkey}@reports.divine.video`;
    isAuthenticated = true;
  } else if (body.reporterEmail) {
    if (!isValidEmail(body.reporterEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    requesterEmail = body.reporterEmail;
    isAuthenticated = false;
  } else {
    return new Response(JSON.stringify({ error: 'Must provide either reporterPubkey or reporterEmail' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Build ticket
  const subject = `[Content Report] ${body.reason} - ${body.contentType}`;
  const tags = [
    'content-report',
    'client-divine-web',
    `reason-${body.reason}`,
    `type-${body.contentType}`,
    isAuthenticated ? 'authenticated' : 'anonymous',
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
  bodyParts.push(`**Reporter:** ${isAuthenticated ? `Authenticated user (${body.reporterPubkey})` : `Anonymous (${body.reporterEmail})`}`);

  const ticketPayload = {
    ticket: {
      subject,
      comment: { body: bodyParts.join('\n') },
      requester: { email: requesterEmail },
      tags,
      priority: getPriority(body.reason),
    },
  };

  // Create Zendesk ticket
  const zendeskUrl = `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets.json`;
  const auth = btoa(`${ZENDESK_API_EMAIL}/token:${ZENDESK_API_TOKEN}`);

  try {
    const response = await fetch(zendeskUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(ticketPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zendesk API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to create ticket' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const data = await response.json() as { ticket: { id: number } };
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
