import { describe, expect, it } from 'vitest';

import {
  buildCategoriesIndexMeta,
  buildCategoryPageMeta,
  buildProfilePageMeta,
  buildVideoPageMeta,
  decodeNpubToHex,
} from './serverSocialMeta';

describe('serverSocialMeta', () => {
  it('falls back to summary text when a video title tag is blank', () => {
    const meta = buildVideoPageMeta(
      new URL('https://divine.video/video/0b5bb00712dfcb9a835b0f81a64b003dec950f85e9176930aa9b9389f0da24cb'),
      {
        event: {
          id: '34781043c7550cf930d01ba9d2d8ef537fbf8c175007b53d5e9fa2a310f92356',
          content: 'Choo choo!\n\nInspired by nostr:npub15l5atkgtzladdezjdnjc7zhej7uvzjpxaj7mctpe2hnwyk85qqxqjuecgm',
          tags: [
            ['d', '0b5bb00712dfcb9a835b0f81a64b003dec950f85e9176930aa9b9389f0da24cb'],
            ['title', ''],
            ['summary', 'Choo choo!'],
            ['alt', ''],
            ['imeta', 'url https://media.divine.video/0b5bb00712dfcb9a835b0f81a64b003dec950f85e9176930aa9b9389f0da24cb', 'm video/mp4', 'image https://media.divine.video/97c2020b3aee67acc202fcff87ccebca8bd0ca60b32a4de0621c154869db0dfa'],
          ],
        },
        stats: {
          author_name: 'The Wall!',
        },
      }
    );

    expect(meta.title).toBe('Choo choo!');
    expect(meta.description).toContain('Inspired by nostr:npub1');
    expect(meta.image).toBe('https://media.divine.video/97c2020b3aee67acc202fcff87ccebca8bd0ca60b32a4de0621c154869db0dfa');
    expect(meta.videoUrl).toBe('https://media.divine.video/0b5bb00712dfcb9a835b0f81a64b003dec950f85e9176930aa9b9389f0da24cb');
  });

  it('builds profile metadata for apex /profile/:npub routes', () => {
    const meta = buildProfilePageMeta(
      new URL('https://divine.video/profile/npub1qakf0yuzhy846w3ty8u4u8hgddsr8u2vjtneklad8lslzpelfzrqsy63m7'),
      {
        profile: {
          display_name: 'The Wall!',
          name: '',
          about: 'How can you have any pudding if you have not eaten your meat? ',
          picture: 'https://media.divine.video/545aff83f83b4643f340747213e86520fac83596f899e8ea3117e0aa8b260f7b',
        },
        stats: {
          video_count: 125,
        },
      }
    );

    expect(meta.title).toBe('The Wall! on Divine');
    expect(meta.description).toBe('How can you have any pudding if you have not eaten your meat?');
    expect(meta.image).toBe('https://media.divine.video/545aff83f83b4643f340747213e86520fac83596f899e8ea3117e0aa8b260f7b');
    expect(meta.url).toBe('https://divine.video/profile/npub1qakf0yuzhy846w3ty8u4u8hgddsr8u2vjtneklad8lslzpelfzrqsy63m7');
  });

  it('builds category metadata with a readable label and count-aware description', () => {
    const meta = buildCategoryPageMeta(
      new URL('https://divine.video/category/dance'),
      { video_count: 895 }
    );

    expect(meta.title).toBe('Dance Videos - Divine');
    expect(meta.description).toBe('Explore 895 dance videos on Divine.');
    expect(meta.ogType).toBe('website');
  });

  it('builds generic categories index metadata', () => {
    const meta = buildCategoriesIndexMeta(new URL('https://divine.video/category'));

    expect(meta.title).toBe('Browse Categories - Divine');
    expect(meta.description).toContain('Explore video categories on Divine');
  });

  it('decodes npub identifiers to hex pubkeys', () => {
    expect(
      decodeNpubToHex('npub1qakf0yuzhy846w3ty8u4u8hgddsr8u2vjtneklad8lslzpelfzrqsy63m7')
    ).toBe('076c979382b90f5d3a2b21f95e1ee86b6033f14c92e79b7fad3fe1f1073f4886');
  });
});
