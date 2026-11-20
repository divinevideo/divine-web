// ABOUTME: Tidies a typed or pasted YouTube channel into the NIP-39 identity the verifier accepts
// ABOUTME: Mirrors the verifier's grammar: a channel id, or a handle written with its @

// The verification service accepts exactly two YouTube identities, and these
// patterns copy its own (src/utils/youtube-identity.ts in
// divine-identify-verification-service), so the page refuses up front what the
// verifier would refuse later.
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

// A handle: letters and digits in any script, plus _ - . and the middle dot,
// which can't start or end it. Combining marks may follow only a letter or digit.
const HANDLE_NAME = /^[\p{L}\p{N}]\p{M}*(?:[_.·-]*[\p{L}\p{N}]\p{M}*)*$/u;

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

/** Whether this is a YouTube channel id: UC followed by 22 characters, letter case included. */
export function isYouTubeChannelId(text: string): boolean {
  return CHANNEL_ID.test(text);
}

// A channel link's identity: /@handle or /channel/UC..., anything after ignored.
// Other YouTube links (videos, /c/ and /user/ names) don't name a channel the
// verifier can check, so they give nothing.
function identityFromLink(text: string): string | null {
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;
  const [first, second] = url.pathname.split('/').filter(Boolean);
  if (first?.startsWith('@')) {
    // URL percent-encodes a handle in another script; a malformed escape gives nothing.
    try {
      return tidyName(decodeURIComponent(first));
    } catch {
      return null;
    }
  }
  if (first === 'channel' && second && isYouTubeChannelId(second)) return second;
  return null;
}

function tidyName(text: string): string | null {
  if (isYouTubeChannelId(text)) return text;
  const name = text.startsWith('@') ? text.slice(1) : text;
  return HANDLE_NAME.test(name) ? `@${name}` : null;
}

/**
 * The NIP-39 identity for a YouTube channel typed or pasted by a person: a
 * channel id as it is, or a handle with its @ (`alice` becomes `@alice`, the
 * one spelling the verifier publishes). Accepts a channel link too. `null`
 * means the verifier wouldn't accept it.
 */
export function tidyYouTubeIdentity(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  // The page saved pasted /channel/ links this way before, so editing one of
  // those older entries still works.
  if (text.startsWith('channel/') && isYouTubeChannelId(text.slice('channel/'.length))) {
    return text.slice('channel/'.length);
  }
  if (text.includes('/')) return identityFromLink(text);
  return tidyName(text);
}
