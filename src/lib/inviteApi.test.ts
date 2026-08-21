import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InviteApiError,
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

    await expect(validateInviteCode('ABCD-EFGH')).rejects.toMatchObject({
      code: 'unavailable',
      message: 'Invite service unavailable',
      status: 0,
    } satisfies Partial<InviteApiError>);
  });
});
