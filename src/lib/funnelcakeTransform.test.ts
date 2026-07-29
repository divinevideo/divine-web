import { describe, expect, it } from 'vitest';
import { mergeVideoStats, parseFullEvent, transformFunnelcakeVideo, transformToVideoPage } from './funnelcakeTransform';
import type { FunnelcakeVideoRaw, FunnelcakeResponse } from '@/types/funnelcake';

function makeRawVideo(overrides: Partial<FunnelcakeVideoRaw> = {}): FunnelcakeVideoRaw {
  return {
    id: 'video-1',
    pubkey: 'pubkey-1',
    created_at: 1700000000,
    kind: 34236,
    d_tag: 'vine-id',
    title: 'Test title',
    content: 'Test content',
    video_url: 'https://media.divine.video/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.mp4',
    ...overrides,
  };
}

describe('transformFunnelcakeVideo', () => {
  it('treats direct lookup videos with a platform tag as archived Vine imports', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      tags: [
        ['platform', 'vine'],
        ['d', 'vine-id'],
      ],
    }));

    expect(video.isVineMigrated).toBe(true);
    expect(video.origin).toEqual({
      platform: 'vine',
      externalId: 'vine-id',
    });
  });

  it('prefers the Vine origin tag external id over the d tag', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      d_tag: 'addressable-d-tag',
      tags: [
        ['origin', 'vine', 'origin-id', 'https://vine.co/v/origin-id'],
        ['d', 'addressable-d-tag'],
      ],
    }));

    expect(video.isVineMigrated).toBe(true);
    expect(video.origin).toEqual({
      platform: 'vine',
      externalId: 'origin-id',
    });
  });

  it('prefers archived Vine loop tags over current Divine loop fields', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      platform: 'vine',
      loops: 28,
      content: 'Original stats: 296,752 loops - 5,753 likes',
      tags: [
        ['platform', 'vine'],
        ['loops', '296752'],
        ['d', '592tnaPXh6z'],
      ],
    }));

    expect(video.loopCount).toBe(296752);
  });

  it('preserves native Divine loop counts separately from view starts', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      platform: '',
      classic: false,
      loops: 11,
      views: 23,
    }));

    expect(video.isVineMigrated).toBe(false);
    expect(video.loopCount).toBe(11);
    expect(video.divineViewCount).toBe(23);
  });

  it('preserves the age-restricted flag from the API payload', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      age_restricted: true,
    }));

    expect(video.ageRestricted).toBe(true);
  });

  it('sums embedded_* and current engagement counts (v2 schema)', () => {
    // v2 /api/v2/videos returns BOTH families: `embedded_*` is archive-import
    // stats (Vine), `reactions|comments|reposts` is current Nostr engagement.
    // We sum them so the visible numbers reflect total activity (archive +
    // current), and native videos with no archive history still show real
    // current counts.
    const native = transformFunnelcakeVideo(makeRawVideo({
      embedded_likes: 0,
      embedded_comments: 0,
      embedded_reposts: 0,
      reactions: 24,
      comments: 9,
      reposts: 3,
    }));

    expect(native.likeCount).toBe(24);
    expect(native.commentCount).toBe(9);
    expect(native.repostCount).toBe(3);

    const archived = transformFunnelcakeVideo(makeRawVideo({
      embedded_likes: 138577,
      embedded_comments: 3014,
      embedded_reposts: 37586,
      reactions: 10,
      comments: 0,
      reposts: 0,
    }));

    expect(archived.likeCount).toBe(138587);
    expect(archived.commentCount).toBe(3014);
    expect(archived.repostCount).toBe(37586);
  });

  // Regression guard: list endpoints (/api/videos, /api/users/{pubkey}/videos,
  // discovery, etc.) omit Nostr `tags`, so proofMode arrives undefined and the
  // verification dialog must lazy-fetch the single-video endpoint to recover
  // it. See VideoVerificationDetailsDialog.tsx.
  it('returns proofMode undefined when tags are absent (list endpoint shape)', () => {
    const video = transformFunnelcakeVideo(makeRawVideo());
    expect(video.proofMode).toBeUndefined();
  });

  it('maps compact proof summary when list endpoint omits tags', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      proof: {
        status: 'present',
        level: 'basic_proof',
        checked_at: 1779494400,
        version: 1,
        checks: {
          proofmode_present: true,
          proofmode_parse_ok: true,
          pgp_signature_present: true,
          pgp_signature_valid: null,
          device_attestation_present: false,
          device_attestation_valid: null,
          c2pa_manifest_present: false,
          c2pa_manifest_valid: null,
        },
      },
    }));

    expect(video.proofMode?.level).toBe('basic_proof');
    expect(video.proofMode?.manifest).toBe('summary:present');
    expect(video.proofMode?.pgpFingerprint).toBe('summary:present');
    expect(video.proofMode?.deviceAttestation).toBeUndefined();
    expect(video.proofMode?.c2paManifestId).toBeUndefined();
  });

  it('uses compact proof summary when full event tags contain no proof data', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      tags: [
        ['d', 'vine-id-1'],
        ['title', 'Plain tagged video'],
      ],
      proof: {
        status: 'present',
        level: 'basic_proof',
        checked_at: 1779494400,
        version: 1,
        checks: {
          proofmode_present: true,
          proofmode_parse_ok: true,
          pgp_signature_present: true,
          pgp_signature_valid: null,
        },
      },
    }));

    expect(video.proofMode?.level).toBe('basic_proof');
    expect(video.proofMode?.manifest).toBe('summary:present');
    expect(video.proofMode?.pgpFingerprint).toBe('summary:present');
  });

  it('ignores invalid compact proof summaries', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      proof: {
        status: 'invalid',
        version: 1,
        checks: {
          proofmode_present: true,
          proofmode_parse_ok: false,
          pgp_signature_present: true,
          pgp_signature_valid: false,
          device_attestation_present: true,
          device_attestation_valid: false,
          c2pa_manifest_present: true,
          c2pa_manifest_valid: false,
        },
      },
    }));

    expect(video.proofMode).toBeUndefined();
  });

  it('defaults verified compact proof summaries to verified_web when level is missing', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      proof: {
        status: 'verified',
        checked_at: 1779494400,
        version: 1,
        checks: {
          proofmode_present: true,
          proofmode_parse_ok: true,
          pgp_signature_present: true,
          pgp_signature_valid: true,
          device_attestation_present: true,
          device_attestation_valid: true,
          c2pa_manifest_present: true,
          c2pa_manifest_valid: true,
        },
      },
    }));

    expect(video.proofMode?.level).toBe('verified_web');
    expect(video.proofMode?.manifest).toBe('summary:present');
    expect(video.proofMode?.pgpFingerprint).toBe('summary:present');
    expect(video.proofMode?.deviceAttestation).toBe('summary:present');
    expect(video.proofMode?.c2paManifestId).toBe('summary:present');
  });

  it('caps verified_* summary levels to basic_proof when status is not verified', () => {
    const present = transformFunnelcakeVideo(makeRawVideo({
      proof: {
        status: 'present',
        level: 'verified_mobile',
        version: 1,
        checks: {
          proofmode_present: true,
          proofmode_parse_ok: true,
        },
      },
    }));

    expect(present.proofMode?.level).toBe('basic_proof');

    const partial = transformFunnelcakeVideo(makeRawVideo({
      proof: {
        status: 'partial',
        level: 'verified_web',
        version: 1,
        checks: {
          pgp_signature_present: true,
          pgp_signature_valid: null,
        },
      },
    }));

    expect(partial.proofMode?.level).toBe('basic_proof');
  });

  it('honors verified_* summary levels when status is verified', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      proof: {
        status: 'verified',
        level: 'verified_mobile',
        version: 1,
        checks: {
          proofmode_present: true,
          proofmode_parse_ok: true,
          device_attestation_present: true,
          device_attestation_valid: true,
        },
      },
    }));

    expect(video.proofMode?.level).toBe('verified_mobile');
  });

  it('ignores verified summaries with no usable components', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      proof: {
        status: 'verified',
        version: 1,
        checks: {
          proofmode_present: false,
          proofmode_parse_ok: null,
          pgp_signature_present: true,
          pgp_signature_valid: false,
          device_attestation_present: false,
          device_attestation_valid: null,
          c2pa_manifest_present: false,
          c2pa_manifest_valid: null,
        },
      },
    }));

    expect(video.proofMode).toBeUndefined();
  });

  it('does not mark explicitly invalid proof components as present', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      proof: {
        status: 'present',
        version: 1,
        checks: {
          proofmode_present: true,
          proofmode_parse_ok: false,
          pgp_signature_present: true,
          pgp_signature_valid: false,
          device_attestation_present: true,
          device_attestation_valid: false,
          c2pa_manifest_present: true,
          c2pa_manifest_valid: false,
        },
      },
    }));

    expect(video.proofMode).toBeUndefined();
  });

  it('maps partial compact proof summaries only when a usable component is present', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      proof: {
        status: 'partial',
        version: 1,
        checks: {
          proofmode_present: true,
          proofmode_parse_ok: false,
          c2pa_manifest_present: true,
          c2pa_manifest_valid: null,
        },
      },
    }));

    expect(video.proofMode?.level).toBe('basic_proof');
    expect(video.proofMode?.manifest).toBeUndefined();
    expect(video.proofMode?.c2paManifestId).toBe('summary:present');
  });

  it('extracts proofMode when verification tags are present (single-video shape)', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      tags: [
        ['d', 'vine-id'],
        ['verification', 'verified_mobile'],
        ['c2pa_manifest_id', 'urn:c2pa:test'],
        ['device_attestation', 'attest-blob'],
        ['proofmode', '{"videoHash":"abc"}'],
      ],
    }));

    expect(video.proofMode?.level).toBe('verified_mobile');
    expect(video.proofMode?.c2paManifestId).toBe('urn:c2pa:test');
    expect(video.proofMode?.deviceAttestation).toBe('attest-blob');
  });

  it('maps the raw Nostr content (description) to video.content, not the title', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      title: 'First Divine Compilation 2026!',
      content: 'I just made the world’s first divine compilation.\n\nLink: https://youtu.be/abc',
    }));

    expect(video.title).toBe('First Divine Compilation 2026!');
    expect(video.content).toBe('I just made the world’s first divine compilation.\n\nLink: https://youtu.be/abc');
  });

  it('leaves video.content empty when the API response has no content field', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      title: 'A title with no description',
      content: undefined,
    }));

    expect(video.title).toBe('A title with no description');
    expect(video.content).toBe('');
  });
});

describe('parseFullEvent', () => {
  const verificationTags = [
    ['d', 'vine-id'],
    ['verification', 'verified_mobile'],
  ];

  const fullEventPayload = {
    id: 'json-id',
    pubkey: 'json-pubkey',
    created_at: 1800000000,
    kind: 34236,
    tags: verificationTags,
    content: 'from event_json',
    sig: 'json-sig',
  };

  it('parses a string event_json payload', () => {
    const event = parseFullEvent(
      makeRawVideo({ event_json: JSON.stringify(fullEventPayload) }),
      'video-1',
      'pubkey-1',
    );

    expect(event).toEqual(fullEventPayload);
  });

  it('passes through an object event_json payload', () => {
    const event = parseFullEvent(
      makeRawVideo({ event_json: fullEventPayload }),
      'video-1',
      'pubkey-1',
    );

    expect(event).toEqual(fullEventPayload);
  });

  it('falls back to top-level tags when event_json is malformed', () => {
    const event = parseFullEvent(
      makeRawVideo({ event_json: '{not valid json', tags: verificationTags }),
      'video-1',
      'pubkey-1',
    );

    expect(event?.id).toBe('video-1');
    expect(event?.pubkey).toBe('pubkey-1');
    expect(event?.tags).toEqual(verificationTags);
  });

  it('returns undefined when event_json is malformed and no tags exist', () => {
    const event = parseFullEvent(
      makeRawVideo({ event_json: '{not valid json' }),
      'video-1',
      'pubkey-1',
    );

    expect(event).toBeUndefined();
  });

  it('defaults missing event fields from the raw payload', () => {
    const event = parseFullEvent(
      makeRawVideo({ event_json: { tags: verificationTags } }),
      'video-1',
      'pubkey-1',
    );

    expect(event).toEqual({
      id: 'video-1',
      pubkey: 'pubkey-1',
      created_at: 1700000000,
      kind: 34236,
      tags: verificationTags,
      content: 'Test content',
      sig: '',
    });
  });

  it('feeds event_json tags into proofMode extraction', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      event_json: JSON.stringify(fullEventPayload),
    }));

    expect(video.proofMode?.level).toBe('verified_mobile');
  });
});

function makeResponse(overrides: Partial<FunnelcakeResponse> = {}): FunnelcakeResponse {
  return {
    videos: [makeRawVideo()],
    has_more: true,
    next_cursor: 'abc123',
    ...overrides,
  };
}

describe('transformToVideoPage', () => {
  it('normalizes bare edge-injected video arrays', () => {
    const page = transformToVideoPage([makeRawVideo()]);

    expect(page.videos).toHaveLength(1);
    expect(page.videos[0]?.id).toBe('video-1');
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });

  describe('cursor type (recommendations)', () => {
    it('returns raw cursor string when cursorType is cursor', () => {
      const page = transformToVideoPage(makeResponse({ next_cursor: 'opaque-cursor-xyz' }), 'cursor');
      expect(page.rawCursor).toBe('opaque-cursor-xyz');
      expect(page.nextCursor).toBeUndefined();
      expect(page.offset).toBeUndefined();
    });

    it('returns no rawCursor when has_more is false', () => {
      const page = transformToVideoPage(makeResponse({ has_more: false, next_cursor: 'opaque-cursor-xyz' }), 'cursor');
      expect(page.rawCursor).toBeUndefined();
      expect(page.hasMore).toBe(false);
    });

    it('returns no rawCursor when next_cursor is null/undefined', () => {
      const page = transformToVideoPage(makeResponse({ has_more: true, next_cursor: undefined }), 'cursor');
      expect(page.rawCursor).toBeUndefined();
    });
  });

  describe('offset type', () => {
    it('parses next_cursor as integer offset', () => {
      const page = transformToVideoPage(makeResponse({ next_cursor: '24' }), 'offset');
      expect(page.offset).toBe(24);
      expect(page.rawCursor).toBeUndefined();
    });
  });

  describe('timestamp type (default)', () => {
    it('parses next_cursor as numeric timestamp', () => {
      const page = transformToVideoPage(makeResponse({ next_cursor: '1700000000' }), 'timestamp');
      expect(page.nextCursor).toBe(1700000000);
      expect(page.rawCursor).toBeUndefined();
      expect(page.offset).toBeUndefined();
    });
  });

  it('stops pagination when has_more is false', () => {
    const page = transformToVideoPage(makeResponse({ has_more: false }));
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
    expect(page.offset).toBeUndefined();
    expect(page.rawCursor).toBeUndefined();
  });
});

describe('mergeVideoStats', () => {
  it('refreshes native Divine loop counts from stats', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      platform: '',
      classic: false,
      loops: 2,
      views: 7,
    }));

    const merged = mergeVideoStats(video, { loops: 11 });

    expect(merged.loopCount).toBe(11);
  });
});
