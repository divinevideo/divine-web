/**
 * Every host Discord's own clients hand a user on "Copy Message Link". The
 * Canary and PTB builds use their own subdomains, and links shared before the
 * rename still carry discordapp.com; all of them serve the same message.
 */
const MESSAGE_LINK_HOSTS = new Set([
  'discord.com',
  'www.discord.com',
  'canary.discord.com',
  'ptb.discord.com',
  'discordapp.com',
  'www.discordapp.com',
  'canary.discordapp.com',
  'ptb.discordapp.com',
]);

/** Whether `value` is a Discord message link the verifier can resolve. */
export function isDiscordMessageLink(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (!MESSAGE_LINK_HOSTS.has(url.hostname.toLowerCase())) return false;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 4 || segments[0] !== 'channels') return false;

  // A DM link spells the guild `@me`, and no bot is in that conversation.
  return segments.slice(1).every((segment) => /^\d+$/.test(segment));
}

/**
 * Turns what the user pasted into the identity/proof pair the verifier expects.
 *
 * The proof passes through whole: the verifier parses the message URL itself,
 * and a Discord message id is meaningless without the channel it lives in.
 *
 * The identity is deliberately absent. A message URL names a guild, a channel
 * and a message — never the author — so the username has to be typed. Deriving
 * one from the URL made it a snowflake, which the verifier's author check can
 * never match.
 */
export function discordProofFromInput(input: string): {
  identity?: string;
  proof: string;
} {
  return { proof: input.trim() };
}
