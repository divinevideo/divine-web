const INVITE_API_BASE_URL = import.meta.env.VITE_INVITE_API_URL || 'https://invite.divine.video';

export type InviteApiErrorCode = 'invalid_invite' | 'unavailable' | 'unknown';

export interface InviteValidationResult {
  valid: true;
  normalizedCode: string;
}

export class InviteApiError extends Error {
  code: InviteApiErrorCode;
  status: number;
  inviteStatus?: string;

  constructor(message: string, code: InviteApiErrorCode, status: number, inviteStatus?: string) {
    super(message);
    this.name = 'InviteApiError';
    this.code = code;
    this.status = status;
    this.inviteStatus = inviteStatus;
  }
}

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toInviteApiError(response: Response, body: Record<string, unknown>): InviteApiError {
  const code = typeof body.code === 'string' ? body.code : undefined;
  const message = typeof body.error === 'string' ? body.error : 'Invite service request failed';
  const inviteStatus = typeof body.status === 'string' ? body.status : undefined;

  if (response.status === 400 || response.status === 404 || code === 'invalid_invite') {
    return new InviteApiError(message, 'invalid_invite', response.status, inviteStatus);
  }

  if (response.status >= 500 || response.status === 0) {
    return new InviteApiError(message, 'unavailable', response.status, inviteStatus);
  }

  return new InviteApiError(message, 'unknown', response.status, inviteStatus);
}

function toNetworkInviteApiError(error: unknown): InviteApiError {
  const message = error instanceof Error && error.message
    ? error.message
    : 'Invite service unavailable';

  return new InviteApiError(
    message === 'Failed to fetch' ? 'Invite service unavailable' : message,
    'unavailable',
    0,
  );
}

export async function validateInviteCode(code: string): Promise<InviteValidationResult> {
  const normalizedCode = normalizeInviteCode(code);
  let response: Response;
  try {
    response = await fetch(`${INVITE_API_BASE_URL}/v1/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normalizedCode }),
    });
  } catch (error) {
    throw toNetworkInviteApiError(error);
  }
  const body = await readJson(response);

  if (!response.ok || body.valid === false) {
    throw toInviteApiError(response, body);
  }

  return {
    valid: true,
    normalizedCode: typeof body.normalizedCode === 'string'
      ? body.normalizedCode
      : typeof body.normalized_code === 'string'
        ? body.normalized_code
        : normalizedCode,
  };
}
