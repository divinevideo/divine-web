// @generated from analytics/event-contract.yaml.
// Source contract commit: 687df20125fac8b8643892e7cfaefbd84606c83c
// DO NOT EDIT. Update the contract and run analytics/codegen/generate.py.
export const PRODUCT_ANALYTICS_CONTRACT_COMMIT = '687df20125fac8b8643892e7cfaefbd84606c83c' as const;
export const PRODUCT_ANALYTICS_SCHEMA_VERSION = 1 as const;
export const PRODUCT_ANALYTICS_CONSENT_DEFAULT_ENABLED: boolean | null = null;

export type ProductAnalyticsSource = 'mobile' | 'web';

export type ProductAnalyticsPlatform = 'ios' | 'android' | 'web';

export type ProductAnalyticsConsentCategory = 'product_analytics';

export type ProductAnalyticsSurface = 'feed' | 'following' | 'discovery' | 'profile' | 'search_results' | 'onboarding' | 'registration' | 'landing' | 'notifications' | 'settings' | 'unknown';

export type ProductAnalyticsPlaybackEndReason = 'ended' | 'paused' | 'navigation' | 'backgrounded' | 'error' | 'unknown';

export type ProductAnalyticsNavigationAction = 'open' | 'back' | 'tab' | 'deep_link' | 'cta' | 'swipe' | 'unknown';

export type ProductAnalyticsOnboardingFlow = 'account_setup' | 'viewer_setup' | 'creator_setup';

export type ProductAnalyticsOnboardingStep = 'welcome' | 'identity' | 'interests' | 'follow_suggestions' | 'notifications' | 'complete';

export type ProductAnalyticsOnboardingResult = 'viewed' | 'completed' | 'skipped' | 'failed';

export type ProductAnalyticsOnboardingReason = 'none' | 'dismissed' | 'validation' | 'network' | 'unknown';

export type ProductAnalyticsAssignmentSource = 'client' | 'server';

export type ProductAnalyticsLandingPage = 'home' | 'download' | 'invite' | 'registration';

export type ProductAnalyticsReferrerClass = 'direct' | 'search' | 'social' | 'referral' | 'campaign' | 'unknown';

export type ProductAnalyticsRegistrationEntryPoint = 'landing' | 'invite' | 'deep_link' | 'download_prompt' | 'unknown';

export const PRODUCT_ANALYTICS_EVENT_NAMES = [
  'content_impression_recorded',
  'playback_session_recorded',
  'navigation_context_recorded',
  'onboarding_step_recorded',
  'experiment_exposure',
  'landing_viewed',
  'registration_started'
] as const;

export type ProductAnalyticsEventName = typeof PRODUCT_ANALYTICS_EVENT_NAMES[number];

export interface ProductAnalyticsEnvelope {
  event_id: string;
  schema_version: 1;
  occurred_at: string;
  anonymous_id: string;
  session_id: string;
  source: ProductAnalyticsSource;
  platform: ProductAnalyticsPlatform;
  release: string;
  consent_category: "product_analytics";
}

export interface ContentImpressionRecordedProperties {
  content_id: string;
  surface: ProductAnalyticsSurface;
  position: number;
  visible_ms: number;
  recommendation_id?: string;
}

export interface PlaybackSessionRecordedProperties {
  playback_session_id: string;
  content_id: string;
  surface: ProductAnalyticsSurface;
  duration_ms: number;
  watched_ms: number;
  loop_count: number;
  completed: boolean;
  end_reason: ProductAnalyticsPlaybackEndReason;
}

export interface NavigationContextRecordedProperties {
  from_surface: ProductAnalyticsSurface;
  to_surface: ProductAnalyticsSurface;
  action: ProductAnalyticsNavigationAction;
  content_id?: string;
  recommendation_id?: string;
}

export interface OnboardingStepRecordedProperties {
  flow: ProductAnalyticsOnboardingFlow;
  step: ProductAnalyticsOnboardingStep;
  result: ProductAnalyticsOnboardingResult;
  reason?: ProductAnalyticsOnboardingReason;
}

export interface ExperimentExposureProperties {
  experiment_key: string;
  variant_key: string;
  assignment_source: ProductAnalyticsAssignmentSource;
}

export interface LandingViewedProperties {
  landing_page: ProductAnalyticsLandingPage;
  referrer_class: ProductAnalyticsReferrerClass;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export interface RegistrationStartedProperties {
  entry_point: ProductAnalyticsRegistrationEntryPoint;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export type ProductAnalyticsEvent = ProductAnalyticsEnvelope & (
  { event_name: 'content_impression_recorded'; properties: ContentImpressionRecordedProperties }
  | { event_name: 'playback_session_recorded'; properties: PlaybackSessionRecordedProperties }
  | { event_name: 'navigation_context_recorded'; properties: NavigationContextRecordedProperties }
  | { event_name: 'onboarding_step_recorded'; properties: OnboardingStepRecordedProperties }
  | { event_name: 'experiment_exposure'; properties: ExperimentExposureProperties }
  | { event_name: 'landing_viewed'; properties: LandingViewedProperties }
  | { event_name: 'registration_started'; properties: RegistrationStartedProperties }
);
