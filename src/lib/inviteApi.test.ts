import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InviteApiError,
  getInviteClientConfig,
  joinInviteWaitlist,
  validateInviteCode,
} from './inviteApi';

const fetchMock = vi.fn<typeof fetch>();

describe('inviteApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('normalizes client config responses from the invite service', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        mode: 'invite_code_required',
        waitlist_enabled: true,
        support_email: 'support@divine.video',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(getInviteClientConfig()).resolves.toEqual({
      mode: 'invite_code_required',
      waitlistEnabled: true,
      supportEmail: 'support@divine.video',
    });
  });

  it('validates invite codes and returns the normalized code', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        valid: true,
        normalized_code: 'ABCD-EFGH',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(validateInviteCode(' abcd-efgh ')).resolves.toEqual({
      valid: true,
      normalizedCode: 'ABCD-EFGH',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://invite.divine.video/v1/validate',
      expect.objectContaining({
        body: JSON.stringify({ code: 'ABCD-EFGH' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    );
  });

  it('maps invalid invite responses to a stable error code', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        error: 'Invite not found',
        code: 'invalid_invite',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(validateInviteCode('missing')).rejects.toMatchObject({
      code: 'invalid_invite',
      message: 'Invite not found',
    } satisfies Partial<InviteApiError>);
  });

  it('maps network failures to an unavailable invite service error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getInviteClientConfig()).rejects.toMatchObject({
      code: 'unavailable',
      message: 'Invite service unavailable',
      status: 0,
    } satisfies Partial<InviteApiError>);
  });

  it('submits waitlist entries to the invite service', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        ok: true,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(joinInviteWaitlist('person@example.com')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://invite.divine.video/v1/waitlist',
      expect.objectContaining({
        body: JSON.stringify({ contact: 'person@example.com', newsletter_opt_in: false }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    );
  });
});
