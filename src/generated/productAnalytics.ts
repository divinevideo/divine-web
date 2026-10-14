// @generated from analytics/event-contract.yaml.
// Source contract commit: 58ec2aa4090d2f17ca0ef1e30d3602f5bd24f9d6
// DO NOT EDIT. Update the contract and run analytics/codegen/generate.py.
export const PRODUCT_ANALYTICS_V2_CONTRACT_COMMIT = '58ec2aa4090d2f17ca0ef1e30d3602f5bd24f9d6' as const;
export const PRODUCT_ANALYTICS_V2_SCHEMA_VERSION = 2 as const;
export const PRODUCT_ANALYTICS_V2_EVENT_ID_ALGORITHM = 'sha256-rfc8785-v1' as const;
export const PRODUCT_ANALYTICS_V2_CONSENT_DEFAULT_ENABLED: boolean | null = null;

export const PRODUCT_ANALYTICS_V2_CONTENT_IMPRESSION_RECORDED_POSITION_MINIMUM = 0 as const;
export const PRODUCT_ANALYTICS_V2_CONTENT_IMPRESSION_RECORDED_POSITION_MAXIMUM = 10000 as const;
export const PRODUCT_ANALYTICS_V2_CONTENT_IMPRESSION_RECORDED_VISIBLE_MS_MINIMUM = 1000 as const;
export const PRODUCT_ANALYTICS_V2_CONTENT_IMPRESSION_RECORDED_VISIBLE_MS_MAXIMUM = 3600000 as const;
export const PRODUCT_ANALYTICS_V2_PLAYBACK_SESSION_RECORDED_DURATION_MS_MINIMUM = 0 as const;
export const PRODUCT_ANALYTICS_V2_PLAYBACK_SESSION_RECORDED_DURATION_MS_MAXIMUM = 86400000 as const;
export const PRODUCT_ANALYTICS_V2_PLAYBACK_SESSION_RECORDED_WATCHED_MS_MINIMUM = 0 as const;
export const PRODUCT_ANALYTICS_V2_PLAYBACK_SESSION_RECORDED_WATCHED_MS_MAXIMUM = 86400000 as const;
export const PRODUCT_ANALYTICS_V2_PLAYBACK_SESSION_RECORDED_LOOP_COUNT_MINIMUM = 0 as const;
export const PRODUCT_ANALYTICS_V2_PLAYBACK_SESSION_RECORDED_LOOP_COUNT_MAXIMUM = 1000 as const;

export type ProductAnalyticsV2Source = 'mobile' | 'web';

export type ProductAnalyticsV2Platform = 'ios' | 'android' | 'web';

export type ProductAnalyticsV2ConsentCategory = 'product_analytics';

export type ProductAnalyticsV2Surface = 'feed' | 'following' | 'discovery' | 'profile' | 'search_results' | 'onboarding' | 'registration' | 'landing' | 'notifications' | 'settings' | 'unknown';

export type ProductAnalyticsV2PlaybackEndReason = 'ended' | 'paused' | 'navigation' | 'backgrounded' | 'error' | 'unknown';

export type ProductAnalyticsV2NavigationAction = 'open' | 'back' | 'tab' | 'deep_link' | 'cta' | 'swipe' | 'unknown';

export type ProductAnalyticsV2OnboardingFlow = 'account_setup' | 'viewer_setup' | 'creator_setup';

export type ProductAnalyticsV2OnboardingStep = 'welcome' | 'identity' | 'interests' | 'follow_suggestions' | 'notifications' | 'complete';

export type ProductAnalyticsV2OnboardingResult = 'viewed' | 'completed' | 'skipped' | 'failed';

export type ProductAnalyticsV2OnboardingReason = 'none' | 'dismissed' | 'validation' | 'network' | 'unknown';

export type ProductAnalyticsV2AssignmentSource = 'client' | 'server';

export type ProductAnalyticsV2LandingPage = 'home' | 'download' | 'invite' | 'registration';

export type ProductAnalyticsV2ReferrerClass = 'direct' | 'search' | 'social' | 'referral' | 'campaign' | 'unknown';

export type ProductAnalyticsV2RegistrationEntryPoint = 'landing' | 'invite' | 'deep_link' | 'download_prompt' | 'unknown';

export const PRODUCT_ANALYTICS_V2_EVENT_NAMES = [
  'content_impression_recorded',
  'playback_session_recorded',
  'navigation_context_recorded',
  'onboarding_step_recorded',
  'experiment_exposure',
  'landing_viewed',
  'registration_started'
] as const;

export type ProductAnalyticsV2EventName = typeof PRODUCT_ANALYTICS_V2_EVENT_NAMES[number];

export interface ProductAnalyticsV2Envelope {
  event_id: string;
  schema_version: 2;
  occurred_at: string;
  anonymous_id: string;
  session_id: string;
  source: ProductAnalyticsV2Source;
  platform: ProductAnalyticsV2Platform;
  release: string;
  consent_category: "product_analytics";
}

export interface ProductAnalyticsV2ContentImpressionRecordedProperties {
  content_id: string;
  surface: ProductAnalyticsV2Surface;
  position: number;
  visible_ms: number;
  recommendation_id?: string;
}

export interface ProductAnalyticsV2PlaybackSessionRecordedProperties {
  playback_session_id: string;
  content_id: string;
  surface: ProductAnalyticsV2Surface;
  duration_ms: number;
  watched_ms: number;
  loop_count: number;
  completed: boolean;
  end_reason: ProductAnalyticsV2PlaybackEndReason;
}

export interface ProductAnalyticsV2NavigationContextRecordedProperties {
  from_surface: ProductAnalyticsV2Surface;
  to_surface: ProductAnalyticsV2Surface;
  action: ProductAnalyticsV2NavigationAction;
  content_id?: string;
  recommendation_id?: string;
}

export interface ProductAnalyticsV2OnboardingStepRecordedProperties {
  flow: ProductAnalyticsV2OnboardingFlow;
  step: ProductAnalyticsV2OnboardingStep;
  result: ProductAnalyticsV2OnboardingResult;
  reason?: ProductAnalyticsV2OnboardingReason;
}

export interface ProductAnalyticsV2ExperimentExposureProperties {
  experiment_key: string;
  variant_key: string;
  assignment_source: ProductAnalyticsV2AssignmentSource;
}

export interface ProductAnalyticsV2LandingViewedProperties {
  landing_page: ProductAnalyticsV2LandingPage;
  referrer_class: ProductAnalyticsV2ReferrerClass;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export interface ProductAnalyticsV2RegistrationStartedProperties {
  entry_point: ProductAnalyticsV2RegistrationEntryPoint;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export type ProductAnalyticsV2Event = ProductAnalyticsV2Envelope & (
  { event_name: 'content_impression_recorded'; properties: ProductAnalyticsV2ContentImpressionRecordedProperties }
  | { event_name: 'playback_session_recorded'; properties: ProductAnalyticsV2PlaybackSessionRecordedProperties }
  | { event_name: 'navigation_context_recorded'; properties: ProductAnalyticsV2NavigationContextRecordedProperties }
  | { event_name: 'onboarding_step_recorded'; properties: ProductAnalyticsV2OnboardingStepRecordedProperties }
  | { event_name: 'experiment_exposure'; properties: ProductAnalyticsV2ExperimentExposureProperties }
  | { event_name: 'landing_viewed'; properties: ProductAnalyticsV2LandingViewedProperties }
  | { event_name: 'registration_started'; properties: ProductAnalyticsV2RegistrationStartedProperties }
);
