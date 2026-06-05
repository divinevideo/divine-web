// ABOUTME: Type definitions for content moderation system
// ABOUTME: Implements NIP-51 mute lists (kind 10001) and NIP-56 reporting (kind 1984)

/**
 * Content filter reasons (NIP-56)
 */
export enum ContentFilterReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  VIOLENCE = 'violence',
  SEXUAL_CONTENT = 'sexual-content',
  COPYRIGHT = 'copyright',
  FALSE_INFO = 'false-info',
  CHILD_SAFETY = 'child-safety',
  CSAM = 'csam',
  UNDERAGE_USER = 'underage-user',
  AI_GENERATED = 'ai-generated',
  IMPERSONATION = 'impersonation',
  ILLEGAL = 'illegal',
  OTHER = 'other'
}

/**
 * Content severity levels
 */
export enum ContentSeverity {
  INFO = 'info',           // Informational only
  WARNING = 'warning',     // Show warning but allow viewing
  HIDE = 'hide',          // Hide by default
  BLOCK = 'block'         // Completely block
}

/**
 * Mute types (NIP-51)
 */
export enum MuteType {
  USER = 'p',        // Mute user (pubkey)
  HASHTAG = 't',     // Mute hashtag
  KEYWORD = 'word',  // Mute keyword
  EVENT = 'e'        // Mute specific event/thread
}

/**
 * Mute list entry
 */
export interface MuteItem {
  type: MuteType;
  value: string;           // Pubkey, hashtag, keyword, or event ID
  reason?: string;         // Optional reason
  createdAt: number;       // Unix timestamp
  expireAt?: number;       // Optional expiration (unix timestamp)
}

/**
 * Content report (NIP-56)
 */
export interface ContentReport {
  reportId: string;
  eventId?: string;        // Event being reported
  pubkey?: string;         // User being reported
  reason: ContentFilterReason;
  details: string;
  additionalContext?: string;
  createdAt: number;
}

/**
 * Moderation result
 */
export interface ModerationResult {
  shouldFilter: boolean;
  severity: ContentSeverity;
  reasons: ContentFilterReason[];
  matchingItems: MuteItem[];
  warningMessage?: string;
}

/**
 * Report reason labels
 */
export const REPORT_REASON_LABELS: Record<ContentFilterReason, string> = {
  [ContentFilterReason.SPAM]: 'Spam or unwanted content',
  [ContentFilterReason.HARASSMENT]: 'Harassment, bullying, or threats',
  [ContentFilterReason.VIOLENCE]: 'Violent or extremist content',
  [ContentFilterReason.SEXUAL_CONTENT]: 'Sexual or adult content',
  [ContentFilterReason.COPYRIGHT]: 'Copyright violation',
  [ContentFilterReason.FALSE_INFO]: 'Misinformation or false information',
  [ContentFilterReason.CHILD_SAFETY]: 'Child safety violation',
  [ContentFilterReason.CSAM]: 'Child sexual abuse',
  [ContentFilterReason.UNDERAGE_USER]: 'User appears under 16',
  [ContentFilterReason.AI_GENERATED]: 'Suspected AI-generated content',
  [ContentFilterReason.IMPERSONATION]: 'Impersonation',
  [ContentFilterReason.ILLEGAL]: 'Illegal content',
  [ContentFilterReason.OTHER]: 'Other violation'
};
