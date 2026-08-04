// ABOUTME: Presents NIP-46 auth challenges sent by a remote signer
// ABOUTME: Opens the challenge URL in a new tab and reports a link fallback

/** Schemes a signer is allowed to send us for an auth challenge. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export interface AuthChallengePresentation {
  /** The challenge URL, or null when the signer sent something unusable. */
  url: string | null;
  /** Whether a tab was actually opened. False means show the link instead. */
  opened: boolean;
}

/**
 * Show the user a NIP-46 `auth_url` challenge.
 *
 * The URL arrives from the remote signer, so only web schemes are honoured —
 * handing `javascript:` or `data:` to `window.open` would let a hostile signer
 * run navigation in the user's browser. Popup blockers routinely swallow the
 * tab because this fires after an await, so callers must render the returned
 * URL as a link whenever `opened` is false.
 */
export function presentAuthChallenge(rawUrl: string): AuthChallengePresentation {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return { url: null, opened: false };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { url: null, opened: false };
  }

  const opened = window.open(rawUrl, '_blank', 'noopener,noreferrer');

  return { url: rawUrl, opened: !!opened };
}
