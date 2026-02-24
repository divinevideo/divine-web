// ABOUTME: Firebase Analytics and Performance Monitoring integration
// ABOUTME: Provides functions for logging analytics events, errors, and performance metrics

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, logEvent, setUserId, setAnalyticsCollectionEnabled, type Analytics } from 'firebase/analytics';
import { getPerformance, trace, type FirebasePerformance } from 'firebase/performance';
import { onAnalyticsConsentChanged } from './cookieConsent';

const firebaseConfig = {
  apiKey: "AIzaSyDEdSqDEExCcHMXr6MEvNmY_GJ5ACTtLvA",
  authDomain: "openvine-co.firebaseapp.com",
  projectId: "openvine-co",
  storageBucket: "openvine-co.firebasestorage.app",
  messagingSenderId: "972941478875",
  appId: "1:972941478875:web:cefa0a37c703fd2444b5fe",
  measurementId: "G-HEXR9PF8PV"
};

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let firebasePerf: FirebasePerformance | null = null;
let analyticsEnabled = false;

/**
 * Initialize Firebase App and register consent listener.
 * Analytics and Performance only activate after GDPR consent is granted.
 */
export function initializeAnalytics() {
  try {
    if (typeof window === 'undefined') return;

    app = initializeApp(firebaseConfig);
    console.log('[Analytics] Firebase App initialized (analytics pending consent)');

    onAnalyticsConsentChanged((consented) => {
      if (consented) {
        enableAnalytics();
      } else {
        disableAnalytics();
      }
    });
  } catch (error) {
    console.error('[Analytics] Failed to initialize Firebase:', error);
  }
}

function enableAnalytics() {
  if (!app || analyticsEnabled) return;

  try {
    analytics = getAnalytics(app);
    setAnalyticsCollectionEnabled(analytics, true);
    firebasePerf = getPerformance(app);
    analyticsEnabled = true;

    console.log('[Analytics] Firebase Analytics enabled (consent granted)');
    console.log('[Performance] Firebase Performance Monitoring enabled');

    setupErrorHandlers();
  } catch (error) {
    console.error('[Analytics] Failed to enable analytics:', error);
  }
}

function disableAnalytics() {
  if (analytics) {
    setAnalyticsCollectionEnabled(analytics, false);
  }
  analyticsEnabled = false;
  console.log('[Analytics] Firebase Analytics disabled (consent revoked)');
}

/**
 * Log a custom analytics event
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (!analytics) return;

  try {
    logEvent(analytics, eventName, params);
    console.log('[Analytics] Event tracked:', eventName, params);
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error);
  }
}

/**
 * Log an error event
 */
export function trackError(error: Error, context?: Record<string, unknown>) {
  if (!analytics) return;

  try {
    logEvent(analytics, 'error', {
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      ...context,
    });
    console.error('[Analytics] Error tracked:', error.message, context);
  } catch (err) {
    console.error('[Analytics] Failed to track error:', err);
  }
}

/**
 * Set the current user ID for analytics
 */
export function setAnalyticsUserId(userId: string | null) {
  if (!analytics) return;

  try {
    if (userId) {
      setUserId(analytics, userId);
      console.log('[Analytics] User ID set:', userId.substring(0, 8) + '...');
    } else {
      setUserId(analytics, null);
      console.log('[Analytics] User ID cleared');
    }
  } catch (error) {
    console.error('[Analytics] Failed to set user ID:', error);
  }
}

/**
 * Set up global error handlers to catch unhandled errors
 */
function setupErrorHandlers() {
  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    trackError(event.error || new Error(event.message), {
      source: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    trackError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      {
        source: 'unhandledrejection',
      }
    );
  });

  console.log('[Analytics] Global error handlers set up');
}

/**
 * Track page view
 */
export function trackPageView(pagePath: string, pageTitle?: string) {
  trackEvent('page_view', {
    page_path: pagePath,
    page_title: pageTitle,
  });
}

/**
 * Track video interaction
 */
export function trackVideoEvent(action: 'play' | 'pause' | 'like' | 'repost' | 'comment', videoId: string) {
  trackEvent('video_interaction', {
    action,
    video_id: videoId,
  });
}

/**
 * Track user interaction
 */
export function trackUserAction(action: string, metadata?: Record<string, unknown>) {
  trackEvent('user_action', {
    action,
    ...metadata,
  });
}

/**
 * Track search query (debounced - call this after user stops typing)
 */
export function trackSearch(query: string, filter?: string, resultCount?: number) {
  if (!query.trim()) return;

  trackEvent('search', {
    search_term: query.trim(),
    filter: filter || 'all',
    result_count: resultCount,
  });
}

// Track time to first video playback
let firstVideoPlaybackTracked = false;
const _pageLoadTime = typeof performance !== 'undefined' ? performance.timeOrigin : Date.now();

/**
 * Track time from page load to first video playback
 * Call this when the first video starts playing
 */
export function trackFirstVideoPlayback() {
  if (firstVideoPlaybackTracked) return;
  firstVideoPlaybackTracked = true;

  const timeToFirstVideo = Math.round(window.performance.now());

  trackEvent('first_video_playback', {
    time_to_playback_ms: timeToFirstVideo,
    time_to_playback_seconds: Math.round(timeToFirstVideo / 100) / 10, // 1 decimal place
  });

  console.log(`[Analytics] First video playback: ${timeToFirstVideo}ms from page load`);
}

// ============================================================================
// Firebase Performance Monitoring - Custom Traces
// ============================================================================

/**
 * Start a custom performance trace
 * @returns A trace object with stop() method, or null if performance not initialized
 */
export function startTrace(traceName: string) {
  if (!firebasePerf) return null;

  try {
    const customTrace = trace(firebasePerf, traceName);
    customTrace.start();
    return customTrace;
  } catch (error) {
    console.error('[Performance] Failed to start trace:', error);
    return null;
  }
}

/**
 * Measure an async operation's performance
 * @example
 * const result = await measureAsync('fetch_video_feed', async () => {
 *   return await fetchVideos();
 * });
 */
export async function measureAsync<T>(
  traceName: string,
  operation: () => Promise<T>,
  attributes?: Record<string, string>
): Promise<T> {
  const customTrace = startTrace(traceName);

  if (attributes && customTrace) {
    Object.entries(attributes).forEach(([key, value]) => {
      customTrace.putAttribute(key, value);
    });
  }

  try {
    const result = await operation();
    if (customTrace) {
      customTrace.putAttribute('status', 'success');
      customTrace.stop();
    }
    return result;
  } catch (error) {
    if (customTrace) {
      customTrace.putAttribute('status', 'error');
      customTrace.putAttribute('error_type', error instanceof Error ? error.name : 'unknown');
      customTrace.stop();
    }
    throw error;
  }
}

/**
 * Track a metric within a trace
 */
export function incrementMetric(customTrace: ReturnType<typeof trace> | null, metricName: string, value = 1) {
  if (!customTrace) return;

  try {
    customTrace.incrementMetric(metricName, value);
  } catch (error) {
    console.error('[Performance] Failed to increment metric:', error);
  }
}
