import { describe, expect, it } from 'vitest';
import { parseLegacySocials } from './legacySocials';

describe('parseLegacySocials', () => {
  it('extracts clickable legacy socials from a classic vine profile bio', () => {
    expect(parseLegacySocials({
      displayName: 'YouTube.com/ThomasSanders',
      name: 'thomassanders',
      about: 'I hope you enjoy my shenanigans XD Insta: @ThomasSanders/Twitter: @ThomasSanders/Snapchat: Thomas_Sanders/Business Inquiries: SandersRTP@gmail.com',
      website: 'https://divine.video/profile/abc',
    })).toEqual([
      {
        platform: 'youtube',
        label: 'YouTube',
        handle: 'ThomasSanders',
        url: 'https://www.youtube.com/@ThomasSanders',
      },
      {
        platform: 'instagram',
        label: 'Instagram',
        handle: 'ThomasSanders',
        url: 'https://www.instagram.com/ThomasSanders/',
      },
      {
        platform: 'twitter',
        label: 'Twitter / X',
        handle: 'ThomasSanders',
        url: 'https://twitter.com/ThomasSanders',
      },
      {
        platform: 'snapchat',
        label: 'Snapchat',
        handle: 'Thomas_Sanders',
        url: 'https://www.snapchat.com/add/Thomas_Sanders',
      },
    ]);
  });

  it('ignores unlabeled domains and divine profile URLs', () => {
    expect(parseLegacySocials({
      displayName: 'thomassanders',
      name: 'thomassanders',
      about: 'Business Inquiries: SandersRTP@gmail.com',
      website: 'https://divine.video/profile/abc',
    })).toEqual([]);
  });
});
