import { createDivineClient } from '@divinevideo/login';
import { getPublicKey, nip19 } from 'nostr-tools';

const DIVINE_LOGIN_BASE_URL = import.meta.env.VITE_DIVINE_LOGIN_URL || 'https://login.divine.video';
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

function createClient(fetchImpl: typeof fetch = fetch) {
  return createDivineClient({
    serverUrl: DIVINE_LOGIN_BASE_URL,
    clientId: DIVINE_LOGIN_CLIENT_ID,
    redirectUri: buildCallbackUrl(),
    fetch: fetchImpl,
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
  fetchImpl: typeof fetch = fetch,
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
