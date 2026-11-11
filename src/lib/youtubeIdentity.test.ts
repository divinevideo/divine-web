// ABOUTME: Tests for tidying a typed or pasted YouTube channel into a NIP-39 identity
// ABOUTME: Pins the two forms the verifier accepts: a channel id, or an @handle

import { describe, it, expect } from 'vitest';
import { isYouTubeChannelId, tidyYouTubeIdentity } from './youtubeIdentity';

const CHANNEL_ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';

describe('isYouTubeChannelId', () => {
  it('accepts UC followed by 22 characters', () => {
    expect(isYouTubeChannelId(CHANNEL_ID)).toBe(true);
  });

  it('refuses a name that merely starts with UC', () => {
    expect(isYouTubeChannelId('UCLA')).toBe(false);
    expect(isYouTubeChannelId(`${CHANNEL_ID}x`)).toBe(false);
  });

  it('is case-sensitive, as channel ids are', () => {
    expect(isYouTubeChannelId(CHANNEL_ID.replace('UC', 'uc'))).toBe(false);
  });
});

describe('tidyYouTubeIdentity', () => {
  it('keeps a channel id as it is', () => {
    expect(tidyYouTubeIdentity(CHANNEL_ID)).toBe(CHANNEL_ID);
  });

  it('writes a handle with its @, typed with or without it', () => {
    expect(tidyYouTubeIdentity('@alice')).toBe('@alice');
    expect(tidyYouTubeIdentity('alice')).toBe('@alice');
    expect(tidyYouTubeIdentity('  alice  ')).toBe('@alice');
  });

  it('keeps a handle in any script', () => {
    expect(tidyYouTubeIdentity('élodie')).toBe('@élodie');
    expect(tidyYouTubeIdentity('@名前')).toBe('@名前');
  });

  it('reads the channel/ form older entries were saved in', () => {
    expect(tidyYouTubeIdentity(`channel/${CHANNEL_ID}`)).toBe(CHANNEL_ID);
    expect(tidyYouTubeIdentity('channel/UCLA')).toBeNull();
  });

  it('reads a channel link', () => {
    expect(tidyYouTubeIdentity('https://www.youtube.com/@alice')).toBe('@alice');
    expect(tidyYouTubeIdentity('https://youtube.com/@alice/videos')).toBe('@alice');
    expect(tidyYouTubeIdentity('https://m.youtube.com/@alice')).toBe('@alice');
    expect(tidyYouTubeIdentity(`https://www.youtube.com/channel/${CHANNEL_ID}`)).toBe(CHANNEL_ID);
    expect(tidyYouTubeIdentity('youtube.com/@alice')).toBe('@alice');
    // A link percent-encodes a handle in another script.
    expect(tidyYouTubeIdentity('https://www.youtube.com/@%E5%90%8D%E5%89%8D')).toBe('@名前');
  });

  it('refuses what the verifier does not accept', () => {
    expect(tidyYouTubeIdentity('')).toBeNull();
    expect(tidyYouTubeIdentity('@')).toBeNull();
    expect(tidyYouTubeIdentity('@@alice')).toBeNull();
    expect(tidyYouTubeIdentity('alice smith')).toBeNull();
    expect(tidyYouTubeIdentity('.alice')).toBeNull();
    expect(tidyYouTubeIdentity('alice-')).toBeNull();
    expect(tidyYouTubeIdentity('c/alice')).toBeNull();
    expect(tidyYouTubeIdentity('https://www.youtube.com/c/alice')).toBeNull();
    expect(tidyYouTubeIdentity('https://www.youtube.com/user/alice')).toBeNull();
    expect(tidyYouTubeIdentity('https://www.youtube.com/channel/UCLA')).toBeNull();
    expect(tidyYouTubeIdentity('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(tidyYouTubeIdentity('https://example.com/@alice')).toBeNull();
    expect(tidyYouTubeIdentity('https://www.youtube.com/@%E0')).toBeNull();
  });
});
