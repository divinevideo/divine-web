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

  // `window.open` returns null whenever the feature string sets `noopener`,
  // and `noreferrer` implies `noopener`. That happens whether or not the tab
  // actually opened. Passing either made `opened` permanently false, so every user was
  // told their popup had been blocked even when it had not. Open with no
  // features so the return value means something, then sever the opener
  // reference by hand: `opener` is settable cross-origin, so a hostile signer's
  // page still cannot reach back into this one.
  //
  // The cost of dropping `noreferrer` is that the signer sees this page's URL
  // in the Referer header. That is a party the user is deliberately
  // authenticating against, so it is preferred over lying about the outcome.
  const popup = window.open(rawUrl, '_blank');

  if (popup) {
    popup.opener = null;
  }

  return { url: rawUrl, opened: !!popup };
}
