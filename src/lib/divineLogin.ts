import { getPublicKey, nip19 } from 'nostr-tools';

const DIVINE_LOGIN_BASE_URL = import.meta.env.VITE_DIVINE_LOGIN_URL || 'https://login.divine.video';
const DIVINE_LOGIN_START_PATH = '/oauth/start';
const DIVINE_LOGIN_EXCHANGE_PATH = '/api/oauth/exchange';
const SECURE_ACCOUNT_PREFIX = 'divine:secure-account:';

export interface DivineLoginRedirect {
  state: string;
  url: string;
}

export interface SecureAccountRedirect extends DivineLoginRedirect {
  pubkey: string;
}

export interface DivineLoginCallbackParams {
  bunkerUri?: string;
  code?: string;
  email?: string;
  error?: string;
  pubkey?: string;
  returnPath?: string;
  state?: string;
  token?: string;
}

export interface DivineLoginExchangeResult {
  bunkerUri: string;
  email?: string;
  pubkey?: string;
  returnPath?: string;
  token?: string;
}

function buildCallbackUrl(): string {
  return new URL('/auth/callback', window.location.origin).toString();
}

function buildStartUrl(mode: 'signup' | 'secure_account', state: string, extraParams?: Record<string, string>): string {
  const url = new URL(DIVINE_LOGIN_START_PATH, DIVINE_LOGIN_BASE_URL);
  url.searchParams.set('client', 'divine-web');
  url.searchParams.set('mode', mode);
  url.searchParams.set('redirect_uri', buildCallbackUrl());
  url.searchParams.set('state', state);

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
}

function createState(): string {
  return crypto.randomUUID();
}

export function buildSignupRedirect(options?: { returnPath?: string }): DivineLoginRedirect {
  const state = createState();
  const url = buildStartUrl('signup', state, options?.returnPath ? { return_path: options.returnPath } : undefined);

  return { state, url };
}

export function buildSecureAccountRedirect(nsec: string, options?: { returnPath?: string }): SecureAccountRedirect {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec');
  }

  const state = createState();
  const pubkey = getPublicKey(decoded.data);

  sessionStorage.setItem(`${SECURE_ACCOUNT_PREFIX}${state}`, JSON.stringify({
    createdAt: Date.now(),
    nsec,
    pubkey,
    returnPath: options?.returnPath,
  }));

  const url = buildStartUrl('secure_account', state, {
    byok_pubkey: pubkey,
    ...(options?.returnPath ? { return_path: options.returnPath } : {}),
  });

  return { state, url, pubkey };
}

export function parseDivineLoginCallback(url: string): DivineLoginCallbackParams {
  const parsed = new URL(url);

  return {
    bunkerUri: parsed.searchParams.get('bunker_uri') ?? parsed.searchParams.get('bunkerUrl') ?? undefined,
    code: parsed.searchParams.get('code') ?? undefined,
    email: parsed.searchParams.get('email') ?? undefined,
    error: parsed.searchParams.get('error') ?? undefined,
    pubkey: parsed.searchParams.get('pubkey') ?? undefined,
    returnPath: parsed.searchParams.get('return_path') ?? parsed.searchParams.get('returnTo') ?? undefined,
    state: parsed.searchParams.get('state') ?? undefined,
    token: parsed.searchParams.get('token') ?? undefined,
  };
}

export async function exchangeDivineLoginCallback(
  callback: DivineLoginCallbackParams,
  fetchImpl: typeof fetch = fetch,
): Promise<DivineLoginExchangeResult> {
  if (callback.error) {
    throw new Error(callback.error);
  }

  if (callback.bunkerUri) {
    return {
      bunkerUri: callback.bunkerUri,
      email: callback.email,
      pubkey: callback.pubkey,
      returnPath: callback.returnPath,
      token: callback.token,
    };
  }

  if (!callback.code || !callback.state) {
    throw new Error('Missing callback code or state');
  }

  const response = await fetchImpl(new URL(DIVINE_LOGIN_EXCHANGE_PATH, DIVINE_LOGIN_BASE_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: callback.code,
      state: callback.state,
    }),
  });
  const responseText = await response.text();
  const body = responseText
    ? JSON.parse(responseText) as Record<string, unknown>
    : {};

  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Failed to complete divine login');
  }

  const bunkerUri = typeof body.bunker_uri === 'string'
    ? body.bunker_uri
    : typeof body.bunkerUri === 'string'
      ? body.bunkerUri
      : undefined;
  if (!bunkerUri) {
    throw new Error('Missing bunker URI in login callback exchange');
  }

  return {
    bunkerUri,
    email: typeof body.email === 'string' ? body.email : undefined,
    pubkey: typeof body.pubkey === 'string' ? body.pubkey : undefined,
    returnPath: typeof body.return_path === 'string'
      ? body.return_path
      : typeof body.returnPath === 'string'
        ? body.returnPath
        : callback.returnPath,
    token: typeof body.token === 'string' ? body.token : undefined,
  };
}
