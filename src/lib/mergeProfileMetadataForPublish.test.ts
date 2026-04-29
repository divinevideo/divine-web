import { describe, expect, it } from 'vitest';
import { mergeProfileMetadataForPublish } from './mergeProfileMetadataForPublish';

describe('mergeProfileMetadataForPublish', () => {
  it('sets display_name to name when name is present', () => {
    const result = mergeProfileMetadataForPublish(undefined, {
      name: 'Alice',
      about: 'Bio',
      picture: '',
      banner: '',
      website: '',
      nip05: '',
      bot: false,
    });

    expect(result.display_name).toBe('Alice');
    expect(result.name).toBe('Alice');
  });

  it('overrides stale display_name from existing metadata when name is set', () => {
    const result = mergeProfileMetadataForPublish(
      {
        name: 'Old',
        display_name: 'Stale Display',
        about: 'Old bio',
        picture: 'https://old.pic',
        banner: '',
        website: '',
        nip05: '',
        bot: false,
      },
      {
        name: 'New Name',
        about: 'Old bio',
        picture: 'https://old.pic',
        banner: '',
        website: '',
        nip05: '',
        bot: false,
      }
    );

    expect(result.display_name).toBe('New Name');
    expect(result.name).toBe('New Name');
  });

  it('removes display_name when name is cleared', () => {
    const result = mergeProfileMetadataForPublish(
      {
        name: 'Was Here',
        display_name: 'Was Here',
        about: 'Still here',
        picture: 'https://x',
        banner: '',
        website: '',
        nip05: '',
        bot: false,
      },
      {
        name: '',
        about: 'Still here',
        picture: 'https://x',
        banner: '',
        website: '',
        nip05: '',
        bot: false,
      }
    );

    expect(result.display_name).toBeUndefined();
    expect('display_name' in result).toBe(false);
  });

  it('removes empty-string fields from the merged payload', () => {
    const result = mergeProfileMetadataForPublish(undefined, {
      name: 'Bob',
      about: '',
      picture: 'https://pic',
      banner: '',
      website: '',
      nip05: '',
      bot: false,
    });

    expect(result.name).toBe('Bob');
    expect(result.picture).toBe('https://pic');
    expect(result.about).toBeUndefined();
    expect(result.banner).toBeUndefined();
    expect(result.website).toBeUndefined();
    expect(result.nip05).toBeUndefined();
  });

  it('preserves existing keys not present in form values', () => {
    const result = mergeProfileMetadataForPublish(
      {
        name: 'Curator',
        display_name: 'Curator',
        lud16: 'user@wallet.com',
        about: 'About',
        picture: 'https://p',
        banner: '',
        website: '',
        nip05: '',
        bot: false,
      },
      {
        name: 'Curator',
        about: 'Updated bio',
        picture: 'https://p',
        banner: '',
        website: '',
        nip05: '',
        bot: false,
      }
    );

    expect(result.lud16).toBe('user@wallet.com');
    expect(result.about).toBe('Updated bio');
    expect(result.display_name).toBe('Curator');
  });

  it('does not strip boolean false (bot)', () => {
    const result = mergeProfileMetadataForPublish(undefined, {
      name: 'Bot User',
      about: '',
      picture: '',
      banner: '',
      website: '',
      nip05: '',
      bot: false,
    });

    expect(result.bot).toBe(false);
  });
});
