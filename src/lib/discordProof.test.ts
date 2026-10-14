import { describe, expect, it } from 'vitest';
import { isDiscordMessageLink } from './discordProof';

const GUILD = '1234567890123456789';
const CHANNEL = '9876543210987654321';
const MESSAGE = '1111222233334444555';
const LINK = `https://discord.com/channels/${GUILD}/${CHANNEL}/${MESSAGE}`;

describe('discordProof', () => {
  describe('isDiscordMessageLink', () => {
    it('accepts a message link from every Discord client', () => {
      expect(isDiscordMessageLink(LINK)).toBe(true);
      expect(isDiscordMessageLink(LINK.replace('discord.com', 'canary.discord.com'))).toBe(true);
      expect(isDiscordMessageLink(LINK.replace('discord.com', 'ptb.discord.com'))).toBe(true);
      expect(isDiscordMessageLink(LINK.replace('discord.com', 'discordapp.com'))).toBe(true);
    });

    it('tolerates the shapes a paste picks up', () => {
      expect(isDiscordMessageLink(`${LINK}/`)).toBe(true);
      expect(isDiscordMessageLink(`${LINK}?jump=1`)).toBe(true);
      expect(isDiscordMessageLink(`  ${LINK}  `)).toBe(true);
    });

    it('rejects what cannot resolve to a message', () => {
      // A channel link has no message id, an invite proves nothing, and a DM
      // spells the guild `@me` — no bot is in that conversation.
      expect(isDiscordMessageLink(`https://discord.com/channels/${GUILD}/${CHANNEL}`)).toBe(false);
      expect(isDiscordMessageLink('https://discord.gg/AbCdEf')).toBe(false);
      expect(isDiscordMessageLink(`https://discord.com/channels/@me/${CHANNEL}/${MESSAGE}`)).toBe(false);
      expect(isDiscordMessageLink('not a url')).toBe(false);
      expect(isDiscordMessageLink('')).toBe(false);
    });

    it('rejects a host that merely contains discord.com', () => {
      expect(isDiscordMessageLink(`https://discord.com.evil.example/channels/${GUILD}/${CHANNEL}/${MESSAGE}`)).toBe(false);
    });
  });
});
