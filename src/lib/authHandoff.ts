import { getCookieDomain } from './crossSubdomainAuth';

const INVITE_HANDOFF_COOKIE = 'divine_invite_handoff';
const INVITE_HANDOFF_TTL_MS = 10 * 60 * 1000;

export interface InviteHandoffPayload {
  code: string;
  mode: 'signup';
  createdAt: number;
  returnPath?: string;
}

function encodePayload(payload: InviteHandoffPayload): string {
  return btoa(JSON.stringify(payload));
}

function decodePayload(value: string): InviteHandoffPayload | null {
  try {
    return JSON.parse(atob(value)) as InviteHandoffPayload;
  } catch {
    return null;
  }
}

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function setInviteHandoff(payload: InviteHandoffPayload): void {
  const normalizedPayload: InviteHandoffPayload = {
    ...payload,
    code: normalizeInviteCode(payload.code),
  };

  const parts = [
    `${INVITE_HANDOFF_COOKIE}=${encodePayload(normalizedPayload)}`,
    'path=/',
    `max-age=${Math.floor(INVITE_HANDOFF_TTL_MS / 1000)}`,
    'SameSite=Lax',
    'Secure',
  ];
  const domain = getCookieDomain();

  if (domain) {
    parts.push(`domain=${domain}`);
  }

  document.cookie = parts.join('; ');
}

export function readInviteHandoff(now = Date.now()): InviteHandoffPayload | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${INVITE_HANDOFF_COOKIE}=([^;]+)`));
  if (!match) {
    return null;
  }

  const payload = decodePayload(match[1]);
  if (!payload) {
    clearInviteHandoff();
    return null;
  }

  if (now - payload.createdAt > INVITE_HANDOFF_TTL_MS) {
    clearInviteHandoff();
    return null;
  }

  return payload;
}

export function clearInviteHandoff(): void {
  const domain = getCookieDomain();

  if (domain) {
    document.cookie = `${INVITE_HANDOFF_COOKIE}=; domain=${domain}; path=/; max-age=0; Secure`;
  }

  document.cookie = `${INVITE_HANDOFF_COOKIE}=; path=/; max-age=0; Secure`;
}
