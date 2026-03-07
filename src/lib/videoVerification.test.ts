import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';
import {
  extractSha256FromVideoUrl,
  getAIDetectionResultForEventId,
  getAIDetectionResultForHash,
  parseModerationLabelEvent,
  resolveVideoVerificationBadge,
} from './videoVerification';

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'video-1',
    pubkey: 'pubkey-1',
    kind: 34236,
    createdAt: 1700000000,
    content: '',
    videoUrl: 'https://cdn.example.com/video.mp4',
    hashtags: [],
    vineId: null,
    isVineMigrated: false,
    reposts: [],
    ...overrides,
  };
}

function makeLabelEvent(tags: string[][], createdAt = 1700000000): NostrEvent {
  return {
    id: `label-${createdAt}`,
    pubkey: '121b915baba659cbe59626a8afaf83b01dc42354dfecaad9d465d51bb5715d72',
    created_at: createdAt,
    kind: 1985,
    tags,
    content: '',
    sig: 'sig',
  };
}

describe('resolveVideoVerificationBadge', () => {
  it('prefers original vine over proof and AI inputs', () => {
    const badge = resolveVideoVerificationBadge(
      makeVideo({
        isVineMigrated: true,
        proofMode: { level: 'verified_mobile' },
      }),
      { score: 0.1, isVerified: false },
    );

    expect(badge).toEqual({ kind: 'original_vine' });
  });

  it('upgrades verified mobile proof to platinum when AI indicates likely human', () => {
    const badge = resolveVideoVerificationBadge(
      makeVideo({
        proofMode: { level: 'verified_mobile' },
      }),
      { score: 0.2, isVerified: false },
    );

    expect(badge).toEqual({ kind: 'human_made', tier: 'platinum' });
  });

  it('keeps proof-backed videos as Human Made even when AI score is high', () => {
    const badge = resolveVideoVerificationBadge(
      makeVideo({
        proofMode: { level: 'verified_web' },
      }),
      { score: 0.9, isVerified: false },
    );

    expect(badge).toEqual({ kind: 'human_made', tier: 'verified_web' });
  });

  it('promotes proofless low-score AI videos to Human Made', () => {
    const badge = resolveVideoVerificationBadge(
      makeVideo(),
      { score: 0.3, isVerified: false },
    );

    expect(badge).toEqual({ kind: 'human_made', tier: 'verified_web' });
  });

  it('shows Possibly AI-Generated for proofless high-score AI videos', () => {
    const badge = resolveVideoVerificationBadge(
      makeVideo({
        videoUrl: 'https://media.divine.video/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.mp4',
      }),
      { score: 0.7, isVerified: false },
    );

    expect(badge).toEqual({ kind: 'possibly_ai_generated' });
  });

  it('falls back to Unverified for Divine-hosted proofless videos without AI results', () => {
    const badge = resolveVideoVerificationBadge(
      makeVideo({
        videoUrl: 'https://media.divine.video/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.mp4',
      }),
      null,
    );

    expect(badge).toEqual({ kind: 'unverified' });
  });

  it('falls back to Not Divine Hosted for external proofless videos without AI results', () => {
    const badge = resolveVideoVerificationBadge(makeVideo(), null);

    expect(badge).toEqual({ kind: 'not_divine_hosted' });
  });
});

describe('moderation label parsing', () => {
  it('parses ai-generated content-warning labels with metadata', () => {
    const event = makeLabelEvent([
      ['L', 'content-warning'],
      ['l', 'ai-generated', 'content-warning', '{"confidence":0.91,"source":"hiveai","verified":true}'],
      ['e', 'video-1'],
      ['x', 'hash-1'],
    ]);

    expect(parseModerationLabelEvent(event)).toEqual({
      labelValue: 'ai-generated',
      targetEventId: 'video-1',
      targetPubkey: undefined,
      contentHash: 'hash-1',
      confidence: 0.91,
      source: 'hiveai',
      isVerified: true,
      createdAt: 1700000000,
    });
  });

  it('prefers newer verified AI labels for the same event', () => {
    const older = makeLabelEvent([
      ['L', 'content-warning'],
      ['l', 'ai-generated', 'content-warning', '{"confidence":0.2,"source":"old-model"}'],
      ['e', 'video-1'],
    ], 1700000000);
    const newerVerified = makeLabelEvent([
      ['L', 'content-warning'],
      ['l', 'ai-generated', 'content-warning', '{"confidence":0.8,"source":"review","verified":true}'],
      ['e', 'video-1'],
    ], 1700000100);

    expect(getAIDetectionResultForEventId([older, newerVerified], 'video-1')).toEqual({
      score: 0.8,
      source: 'review',
      isVerified: true,
    });
  });

  it('resolves AI labels by hash', () => {
    const event = makeLabelEvent([
      ['L', 'content-warning'],
      ['l', 'ai-generated', 'content-warning', '{"confidence":0.4,"source":"hiveai"}'],
      ['x', 'hash-1'],
    ]);

    expect(getAIDetectionResultForHash([event], 'hash-1')).toEqual({
      score: 0.4,
      source: 'hiveai',
      isVerified: false,
    });
  });
});

describe('extractSha256FromVideoUrl', () => {
  it('extracts a 64-character hash from Divine media URLs', () => {
    const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    expect(extractSha256FromVideoUrl(`https://media.divine.video/${hash}.mp4`)).toBe(hash);
  });

  it('returns undefined for non-hash URLs', () => {
    expect(extractSha256FromVideoUrl('https://cdn.example.com/video.mp4')).toBeUndefined();
  });
});
