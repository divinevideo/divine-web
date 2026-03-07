// ABOUTME: Shared video verification helpers for badge decisions, AI labels, and moderation lookups
// ABOUTME: Matches the mobile app's badge precedence for original Vine, Proofmode, AI scans, and unverified fallbacks

import type { NostrEvent } from '@nostrify/nostrify';
import { API_CONFIG } from '@/config/api';
import type { ParsedVideoData, ProofModeData, ProofModeLevel } from '@/types/video';

export const DIVINE_MODERATION_PUBKEY =
  '121b915baba659cbe59626a8afaf83b01dc42354dfecaad9d465d51bb5715d72';

export interface AIDetectionResult {
  score: number;
  source?: string;
  isVerified: boolean;
}

export interface ParsedModerationLabel {
  labelValue: string;
  targetEventId?: string;
  targetPubkey?: string;
  contentHash?: string;
  confidence?: number;
  source?: string;
  isVerified: boolean;
  createdAt: number;
}

export interface VideoModerationStatus {
  moderated: boolean;
  blocked: boolean;
  quarantined: boolean;
  ageRestricted: boolean;
  needsReview: boolean;
  aiGenerated: boolean;
  action?: string;
  aiScore?: number;
}

export type HumanMadeTier = 'platinum' | 'verified_mobile' | 'verified_web' | 'basic_proof';

export type VideoVerificationBadge =
  | { kind: 'original_vine' }
  | { kind: 'human_made'; tier: HumanMadeTier }
  | { kind: 'possibly_ai_generated' }
  | { kind: 'unverified' }
  | { kind: 'not_divine_hosted' };

type VerificationVideo = Pick<
  ParsedVideoData,
  'id' | 'vineId' | 'videoUrl' | 'proofMode' | 'isVineMigrated' | 'origin' | 'sha256'
>;

export function isOriginalVineVideo(video: Pick<VerificationVideo, 'isVineMigrated' | 'origin'>): boolean {
  return video.isVineMigrated || video.origin?.platform?.toLowerCase() === 'vine';
}

export function isDivineHostedVideo(videoUrl?: string | null): boolean {
  return (videoUrl ?? '').toLowerCase().includes('divine.video');
}

export function normalizeSha256(value?: string | null): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim().toLowerCase();
  if (trimmed.length !== 64) return undefined;
  return /^[0-9a-f]{64}$/.test(trimmed) ? trimmed : undefined;
}

export function extractSha256FromVideoUrl(videoUrl?: string | null): string | undefined {
  if (!videoUrl) return undefined;

  try {
    const uri = new URL(videoUrl);
    const lastSegment = uri.pathname.split('/').filter(Boolean).at(-1);
    if (!lastSegment) return undefined;

    const basename = lastSegment.split('.').shift();
    return normalizeSha256(basename);
  } catch {
    return undefined;
  }
}

export function resolveAIDetectionHashKey(video: Pick<VerificationVideo, 'sha256' | 'videoUrl' | 'vineId'>): string | undefined {
  return normalizeSha256(video.sha256) ?? extractSha256FromVideoUrl(video.videoUrl) ?? video.vineId ?? undefined;
}

export function resolveModerationStatusSha256(
  video: Pick<VerificationVideo, 'sha256' | 'videoUrl'>,
): string | undefined {
  return normalizeSha256(video.sha256) ?? extractSha256FromVideoUrl(video.videoUrl);
}

export function hasProofMode(proofMode?: ProofModeData): boolean {
  if (!proofMode) return false;

  return Boolean(
    proofMode.manifest ||
      proofMode.deviceAttestation ||
      proofMode.pgpFingerprint ||
      proofMode.c2paManifestId ||
      (proofMode.level && proofMode.level !== 'unverified'),
  );
}

export function getBaseProofLevel(proofMode?: ProofModeData): ProofModeLevel {
  return proofMode?.level ?? 'unverified';
}

export function shouldAutoFetchAiForBadge(video: VerificationVideo): boolean {
  if (isOriginalVineVideo(video)) return false;

  const baseLevel = getBaseProofLevel(video.proofMode);
  return baseLevel === 'verified_mobile' || baseLevel === 'unverified';
}

export function shouldFetchAiForDetails(video: VerificationVideo): boolean {
  return !isOriginalVineVideo(video);
}

export function resolveVideoVerificationBadge(
  video: VerificationVideo,
  aiResult?: AIDetectionResult | null,
): VideoVerificationBadge {
  if (isOriginalVineVideo(video)) {
    return { kind: 'original_vine' };
  }

  const baseLevel = getBaseProofLevel(video.proofMode);
  const hasProofBackedBadge = baseLevel !== 'unverified';
  const isLikelyHuman = aiResult != null && aiResult.score < 0.5;
  const isPossiblyAI = aiResult != null && aiResult.score >= 0.5;

  if (hasProofBackedBadge && baseLevel === 'verified_mobile' && isLikelyHuman) {
    return { kind: 'human_made', tier: 'platinum' };
  }

  if (hasProofBackedBadge) {
    return { kind: 'human_made', tier: baseLevel };
  }

  if (isLikelyHuman) {
    return { kind: 'human_made', tier: 'verified_web' };
  }

  if (isPossiblyAI) {
    return { kind: 'possibly_ai_generated' };
  }

  if (isDivineHostedVideo(video.videoUrl)) {
    return { kind: 'unverified' };
  }

  return { kind: 'not_divine_hosted' };
}

export function getVerificationIntroText(
  video: Pick<VerificationVideo, 'proofMode' | 'videoUrl'>,
  aiResult?: AIDetectionResult | null,
): string {
  if (hasProofMode(video.proofMode)) {
    return "This video's authenticity is verified using Proofmode technology.";
  }

  if (aiResult != null && aiResult.score < 0.5) {
    if (isDivineHostedVideo(video.videoUrl)) {
      return 'This video is hosted on Divine and AI detection indicates it is likely human-made, even though no ProofMode verification data is attached.';
    }

    return 'AI detection indicates this video is likely human-made, though no ProofMode verification data is attached.';
  }

  if (isDivineHostedVideo(video.videoUrl)) {
    return 'This video is unverified. It is hosted on Divine, but no ProofMode verification data is attached yet.';
  }

  return 'This video is unverified and hosted outside Divine. It does not include ProofMode verification data.';
}

export function getVerificationDescription(
  video: Pick<VerificationVideo, 'proofMode'>,
  aiResult?: AIDetectionResult | null,
): { tone: 'platinum' | 'gold' | 'silver' | 'bronze' | 'muted'; text: string } {
  const baseLevel = getBaseProofLevel(video.proofMode);
  const hasHumanAIScan = aiResult != null && aiResult.score < 0.5;

  if (baseLevel === 'verified_mobile' && hasHumanAIScan) {
    return {
      tone: 'platinum',
      text: 'Platinum: Device hardware attestation, cryptographic signatures, Content Credentials (C2PA), and AI scan confirms human origin.',
    };
  }

  if (baseLevel === 'verified_mobile') {
    return {
      tone: 'gold',
      text: 'Gold: Captured on a real device with hardware attestation, cryptographic signatures, and Content Credentials (C2PA).',
    };
  }

  if (baseLevel === 'verified_web') {
    return {
      tone: 'silver',
      text: "Silver: Cryptographic signatures prove this video hasn't been altered since recording.",
    };
  }

  if (baseLevel === 'basic_proof') {
    return {
      tone: 'bronze',
      text: 'Bronze: Basic metadata signatures are present.',
    };
  }

  if (hasHumanAIScan) {
    return {
      tone: 'silver',
      text: 'Silver: AI scan confirms this video is likely human-created.',
    };
  }

  return {
    tone: 'muted',
    text: 'No verification data available for this video.',
  };
}

export function getProofChecklist(proofMode?: ProofModeData): Array<{ label: string; passed: boolean }> {
  return [
    { label: 'Device attestation', passed: !!proofMode?.deviceAttestation },
    { label: 'PGP signature', passed: !!proofMode?.pgpFingerprint },
    { label: 'C2PA Content Credentials', passed: !!proofMode?.c2paManifestId },
    { label: 'Proof manifest', passed: !!proofMode?.manifest },
  ];
}

export function parseModerationLabelEvent(event: NostrEvent): ParsedModerationLabel | null {
  let isContentWarning = false;
  let labelValue: string | undefined;
  let targetEventId: string | undefined;
  let targetPubkey: string | undefined;
  let contentHash: string | undefined;
  let confidence: number | undefined;
  let source: string | undefined;
  let isVerified = false;

  for (const tag of event.tags) {
    if (tag.length < 2) continue;

    const tagName = tag[0];
    const tagValue = tag[1];
    if (!tagName || !tagValue) continue;

    switch (tagName) {
      case 'L':
        if (tagValue === 'content-warning') {
          isContentWarning = true;
        }
        break;
      case 'l':
        if (tag[2] === 'content-warning') {
          labelValue = tagValue;
          isContentWarning = true;

          const metadata = tag[3] ? parseModerationLabelMetadata(tag[3]) : null;
          if (metadata) {
            confidence = metadata.confidence;
            source = metadata.source;
            isVerified = metadata.isVerified;
          }
        }
        break;
      case 'e':
        targetEventId = tagValue;
        break;
      case 'p':
        targetPubkey = tagValue;
        break;
      case 'x':
        contentHash = tagValue;
        break;
    }
  }

  if (!isContentWarning || !labelValue) {
    return null;
  }

  return {
    labelValue,
    targetEventId,
    targetPubkey,
    contentHash,
    confidence,
    source,
    isVerified,
    createdAt: event.created_at,
  };
}

function parseModerationLabelMetadata(
  rawMetadata: string,
): { confidence?: number; source?: string; isVerified: boolean } | null {
  try {
    const parsed = JSON.parse(rawMetadata) as {
      confidence?: number;
      source?: string;
      verified?: boolean;
    };

    return {
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
      source: parsed.source,
      isVerified: parsed.verified === true,
    };
  } catch {
    return null;
  }
}

function rankModerationLabel(a: ParsedModerationLabel, b: ParsedModerationLabel): number {
  if (a.isVerified !== b.isVerified) {
    return a.isVerified ? -1 : 1;
  }

  return b.createdAt - a.createdAt;
}

export function getAIDetectionResultForEventId(
  events: NostrEvent[],
  eventId: string,
): AIDetectionResult | null {
  return getAIDetectionResultFromLabels(
    events.map(parseModerationLabelEvent).filter((label): label is ParsedModerationLabel => label !== null),
    (label) => label.targetEventId === eventId,
  );
}

export function getAIDetectionResultForHash(
  events: NostrEvent[],
  hash: string,
): AIDetectionResult | null {
  return getAIDetectionResultFromLabels(
    events.map(parseModerationLabelEvent).filter((label): label is ParsedModerationLabel => label !== null),
    (label) => label.contentHash === hash,
  );
}

function getAIDetectionResultFromLabels(
  labels: ParsedModerationLabel[],
  predicate: (label: ParsedModerationLabel) => boolean,
): AIDetectionResult | null {
  const match = labels
    .filter((label) => label.labelValue === 'ai-generated' && label.confidence != null)
    .filter(predicate)
    .sort(rankModerationLabel)[0];

  if (!match || match.confidence == null) {
    return null;
  }

  return {
    score: match.confidence,
    source: match.source,
    isVerified: match.isVerified,
  };
}

export async function fetchVideoModerationStatus(
  sha256: string,
  signal?: AbortSignal,
): Promise<VideoModerationStatus | null> {
  const normalized = normalizeSha256(sha256);
  if (!normalized) return null;

  const controllerSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(API_CONFIG.moderationService.timeout)])
    : AbortSignal.timeout(API_CONFIG.moderationService.timeout);

  const url = `${API_CONFIG.moderationService.baseUrl}${API_CONFIG.moderationService.endpoints.checkResult.replace('{sha256}', normalized)}`;

  try {
    const response = await fetch(url, { signal: controllerSignal });
    if (!response.ok) return null;

    const payload = await response.json() as Record<string, unknown>;
    return parseVideoModerationStatus(payload);
  } catch {
    return null;
  }
}

export function parseVideoModerationStatus(payload: Record<string, unknown>): VideoModerationStatus {
  const action = typeof payload.action === 'string' ? payload.action : undefined;
  const normalizedAction = action?.toUpperCase();
  const aiScore = extractAiScore(payload.scores);

  return {
    moderated: payload.moderated === true,
    blocked: payload.blocked === true,
    quarantined: payload.quarantined === true || normalizedAction === 'QUARANTINE',
    ageRestricted: payload.age_restricted === true,
    needsReview: payload.needs_review === true,
    aiGenerated: containsAiSignal(payload.categories) || (aiScore != null && aiScore >= 0.8),
    action,
    aiScore,
  };
}

function containsAiSignal(categories: unknown): boolean {
  const containsAiText = (value: string): boolean => {
    const lower = value.toLowerCase();
    return lower.includes('ai_generated') || lower.includes('ai-generated') || lower.includes('deepfake');
  };

  if (typeof categories === 'string') {
    return containsAiText(categories);
  }

  if (Array.isArray(categories)) {
    return categories.some((value) => typeof value === 'string' && containsAiText(value));
  }

  if (categories && typeof categories === 'object') {
    return Object.entries(categories as Record<string, unknown>).some(([key, value]) => {
      if (containsAiText(key)) return true;
      return typeof value === 'string' && containsAiText(value);
    });
  }

  return false;
}

function extractAiScore(scores: unknown): number | undefined {
  if (!scores || typeof scores !== 'object') return undefined;

  const value = (scores as Record<string, unknown>).ai_generated;
  return typeof value === 'number' ? value : undefined;
}
