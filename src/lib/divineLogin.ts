import { createDivineClient } from '@divinevideo/login';
import { getPublicKey, nip19 } from 'nostr-tools';

import { DIVINE_LOGIN_ORIGIN } from './divineLoginOrigin';

const DIVINE_LOGIN_CLIENT_ID = 'divine-web';
const RETURN_PATH_PREFIX = 'divine:return-path:';

export interface DivineLoginRedirect {
  state: string;
  url: string;
}

export interface SecureAccountRedirect extends DivineLoginRedirect {
  pubkey: string;
}

export interface DivineLoginCallbackParams {
  code?: string;
  error?: string;
  errorDescription?: string;
  returnPath?: string;
  state?: string;
}

export interface DivineLoginExchangeResult {
  authorizationHandle?: string;
  bunkerUri: string;
  expiresIn?: number;
  refreshToken?: string;
  returnPath?: string;
  token?: string;
}

function buildCallbackUrl(): string {
  return new URL('/auth/callback', window.location.origin).toString();
}

function createClient(fetchImpl?: typeof fetch) {
  return createDivineClient({
    serverUrl: DIVINE_LOGIN_ORIGIN,
    clientId: DIVINE_LOGIN_CLIENT_ID,
    redirectUri: buildCallbackUrl(),
    ...(fetchImpl ? {
      fetch: (input, init) => fetchImpl(input, init),
    } : {}),
    // localStorage survives cross-origin redirects more reliably than sessionStorage,
    // which can be lost if the browser opens a new tab or browsing context changes.
    // The SDK cleans up PKCE material after exchangeCode completes.
    storage: localStorage,
  });
}

function getReturnPathKey(state: string): string {
  return `${RETURN_PATH_PREFIX}${state}`;
}

function readStateFromRedirect(url: string): string {
  const state = new URL(url).searchParams.get('state');
  if (!state) {
    throw new Error('Missing OAuth state in divine login redirect');
  }

  return state;
}

function storeReturnPath(state: string, returnPath?: string): void {
  if (!returnPath) {
    return;
  }

  localStorage.setItem(getReturnPathKey(state), returnPath);
}

function readStoredReturnPath(state?: string): string | undefined {
  if (!state) {
    return undefined;
  }

  const key = getReturnPathKey(state);
  const returnPath = localStorage.getItem(key) ?? undefined;
  localStorage.removeItem(key);
  return returnPath;
}

export async function buildSignupRedirect(options?: { returnPath?: string }): Promise<DivineLoginRedirect> {
  const client = createClient();
  const { url } = await client.oauth.getAuthorizationUrl({
    defaultRegister: true,
  });
  const state = readStateFromRedirect(url);

  storeReturnPath(state, options?.returnPath);

  return { state, url };
}

export async function buildLoginRedirect(options?: { returnPath?: string }): Promise<DivineLoginRedirect> {
  const client = createClient();
  const { url } = await client.oauth.getAuthorizationUrl({});
  const state = readStateFromRedirect(url);

  storeReturnPath(state, options?.returnPath);

  return { state, url };
}

export async function buildSecureAccountRedirect(
  nsec: string,
  options?: { returnPath?: string },
): Promise<SecureAccountRedirect> {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec');
  }

  const client = createClient();
  const { url } = await client.oauth.getAuthorizationUrl({
    defaultRegister: true,
    nsec,
  });
  const state = readStateFromRedirect(url);
  const pubkey = getPublicKey(decoded.data);

  storeReturnPath(state, options?.returnPath);

  return { state, url, pubkey };
}

export function parseDivineLoginCallback(url: string): DivineLoginCallbackParams {
  const client = createClient();
  const parsedUrl = new URL(url);
  const state = parsedUrl.searchParams.get('state') ?? undefined;
  const result = client.oauth.parseCallback(url);

  if ('code' in result) {
    return {
      code: result.code,
      returnPath: readStoredReturnPath(state),
      state,
    };
  }

  return {
    error: result.error,
    errorDescription: result.description,
    returnPath: readStoredReturnPath(state),
    state,
  };
}

export async function exchangeDivineLoginCallback(
  callback: DivineLoginCallbackParams,
  fetchImpl?: typeof fetch,
): Promise<DivineLoginExchangeResult> {
  if (callback.error) {
    throw new Error(callback.errorDescription || callback.error);
  }

  if (!callback.code) {
    throw new Error('Missing callback code');
  }

  const client = createClient(fetchImpl);
  const tokens = await client.oauth.exchangeCode(callback.code);
  const bunkerUri = tokens.bunker_url;
  if (!bunkerUri) {
    throw new Error('Missing bunker URL in divine login response');
  }

  return {
    authorizationHandle: tokens.authorization_handle,
    bunkerUri,
    expiresIn: tokens.expires_in,
    refreshToken: tokens.refresh_token,
    returnPath: callback.returnPath ?? readStoredReturnPath(callback.state),
    token: tokens.access_token,
  };
}

/**
 * Renew the hosted access token using the refresh token the SDK persisted on
 * this origin at login time. Delegates rotation + storage to the SDK
 * (`getSessionWithRefresh` refreshes within ~5 min of expiry). Returns the fresh
 * access token, or null when there is no stored session on this origin (e.g. a
 * subdomain) or the refresh failed.
 */
// Module-level singleflight. useCurrentUser() -> useDivineSession() mounts in
// ~55 places, each running its own pre-expiry refresh timer + visibilitychange
// listener that fire together near expiry. Without a shared guard they would all
// call getSessionWithRefresh() at once and race the SDK's single-use, rotating
// refresh token: only the first POST wins, the losers fail and clear the stored
// session (and reuse-detection can revoke the whole token family) — logging the
// user out at the exact renewal this is meant to make seamless. Collapsing
// concurrent calls into one in-flight promise removes the within-tab herd. (Two
// open tabs are separate module instances and still race — that's keycast#250.)
let inFlightRefresh: Promise<string | null> | null = null;

export async function refreshDivineSession(
  fetchImpl?: typeof fetch,
): Promise<string | null> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }
  inFlightRefresh = (async () => {
    const client = createClient(fetchImpl);
    const credentials = await client.oauth.getSessionWithRefresh();
    return credentials?.accessToken ?? null;
  })();
  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
}
