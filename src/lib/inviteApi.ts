const INVITE_API_BASE_URL = import.meta.env.VITE_INVITE_API_URL || 'https://invite.divine.video';

export type InviteClientConfigMode = 'invite_code_required' | 'waitlist_only' | 'open';
export type InviteApiErrorCode = 'invalid_invite' | 'unavailable' | 'unknown';

export interface InviteClientConfig {
  mode: InviteClientConfigMode;
  waitlistEnabled: boolean;
  supportEmail?: string;
}

export interface InviteValidationResult {
  valid: true;
  normalizedCode: string;
}

export interface WaitlistJoinResult {
  ok: true;
}

export class InviteApiError extends Error {
  code: InviteApiErrorCode;
  status: number;

  constructor(message: string, code: InviteApiErrorCode, status: number) {
    super(message);
    this.name = 'InviteApiError';
    this.code = code;
    this.status = status;
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

  if (response.status === 400 || response.status === 404 || code === 'invalid_invite') {
    return new InviteApiError(message, 'invalid_invite', response.status);
  }

  if (response.status >= 500 || response.status === 0) {
    return new InviteApiError(message, 'unavailable', response.status);
  }

  return new InviteApiError(message, 'unknown', response.status);
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

export async function getInviteClientConfig(): Promise<InviteClientConfig> {
  let response: Response;
  try {
    response = await fetch(`${INVITE_API_BASE_URL}/v1/client-config`);
  } catch (error) {
    throw toNetworkInviteApiError(error);
  }
  const body = await readJson(response);

  if (!response.ok) {
    throw toInviteApiError(response, body);
  }

  return {
    mode: (body.mode as InviteClientConfigMode | undefined) || 'invite_code_required',
    waitlistEnabled: Boolean(body.waitlistEnabled ?? body.waitlist_enabled),
    supportEmail: typeof body.supportEmail === 'string'
      ? body.supportEmail
      : typeof body.support_email === 'string'
        ? body.support_email
        : undefined,
  };
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

export async function joinInviteWaitlist(contact: string, newsletterOptIn = false): Promise<WaitlistJoinResult> {
  let response: Response;
  try {
    response = await fetch(`${INVITE_API_BASE_URL}/v1/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: contact.trim(), newsletter_opt_in: newsletterOptIn }),
    });
  } catch (error) {
    throw toNetworkInviteApiError(error);
  }
  const body = await readJson(response);

  if (!response.ok) {
    throw toInviteApiError(response, body);
  }

  return { ok: true };
}
