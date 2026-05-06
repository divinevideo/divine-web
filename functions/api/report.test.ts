import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onRequestPost } from './report';

const env = {
  ZENDESK_SUBDOMAIN: 'rabblelabs',
  ZENDESK_API_EMAIL: 'support@example.com',
  ZENDESK_API_TOKEN: 'token-123',
};

function createContext(body: unknown, origin = 'http://localhost:8080') {
  return {
    request: new Request('https://divine.video/api/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify(body),
    }),
    env,
  };
}

describe('functions/api/report', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates structured bug report tickets with Zendesk bug form fields', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ticket: { id: 99 } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await onRequestPost(createContext({
      reportType: 'bug',
      subject: 'Broken feed',
      description: 'Videos fail to load after sign-in.',
      timestamp: 1_713_355_200_000,
      stepsToReproduce: '1. Sign in\n2. Open feed',
      expectedBehavior: 'The feed should render normally.',
      pageUrl: 'https://divine.video/discovery',
      userAgent: 'Mozilla/5.0',
      appVersion: '1.2.3+456',
      osVersion: 'macOS 14.4',
      reporterEmail: 'guest@example.com',
      reporterName: 'Guest Reporter',
    }));

    expect(response.status).toBe(201);
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://rabblelabs.zendesk.com/api/v2/tickets.json');

    const ticketPayload = JSON.parse(String(init?.body)) as {
      ticket: {
        subject: string;
        ticket_form_id: number;
        tags: string[];
        requester: { email: string; name: string };
        custom_fields: Array<{ id: number; value: string }>;
      };
    };

    expect(ticketPayload.ticket.subject).toBe('Broken feed');
    expect(ticketPayload.ticket.ticket_form_id).toBe(14772963437071);
    expect(ticketPayload.ticket.tags).toEqual(['bug_report', 'divine_app', 'web', 'client-divine-web']);
    expect(ticketPayload.ticket.requester).toEqual({
      email: 'guest@example.com',
      name: 'Guest Reporter',
    });
    expect(ticketPayload.ticket.custom_fields).toEqual(expect.arrayContaining([
      { id: 14332953477519, value: 'incident' },
      { id: 14884176561807, value: 'web' },
      { id: 14884157556111, value: 'macOS 14.4' },
      { id: 14884184890511, value: '456' },
      { id: 14677364166031, value: '1. Sign in\n2. Open feed' },
      { id: 14677341431695, value: 'The feed should render normally.' },
    ]));
  });

  it('includes requester name for authenticated content reports', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ticket: { id: 100 } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const reporterPubkey = 'a'.repeat(64);
    const response = await onRequestPost(createContext({
      contentType: 'video',
      reason: 'spam',
      timestamp: 1_713_355_200_000,
      eventId: 'evt123',
      contentUrl: 'https://divine.video/video/evt123',
      reporterPubkey,
    }));

    expect(response.status).toBe(201);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const ticketPayload = JSON.parse(String(init?.body)) as {
      ticket: {
        tags: string[];
        requester: { email: string; name: string; external_id: string };
        comment: { body: string };
      };
    };

    expect(ticketPayload.ticket.tags).toEqual(expect.arrayContaining([
      'content-report',
      'client-divine-web',
      'nip-56',
      'web',
      'authenticated',
    ]));
    expect(ticketPayload.ticket.requester).toEqual({
      email: `${reporterPubkey}@reports.divine.video`,
      name: reporterPubkey,
      external_id: reporterPubkey,
    });
    expect(ticketPayload.ticket.comment.body).toContain('Reported via Divine web (NIP-56 content report).');
  });
});
