// ABOUTME: Firebase Analytics integration for tracking events and errors
// ABOUTME: Provides functions for logging analytics events, errors, and performance metrics

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, logEvent, setUserId, type Analytics } from 'firebase/analytics';

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

/**
 * Initialize Firebase Analytics
 */
export function initializeAnalytics() {
  try {
    // Only initialize in browser environment
    if (typeof window === 'undefined') return;

    app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);

    console.log('[Analytics] Firebase Analytics initialized');

    // Set up global error handlers
    setupErrorHandlers();
  } catch (error) {
    console.error('[Analytics] Failed to initialize Firebase Analytics:', error);
  }
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
const pageLoadTime = typeof performance !== 'undefined' ? performance.timeOrigin : Date.now();

/**
 * Track time from page load to first video playback
 * Call this when the first video starts playing
 */
export function trackFirstVideoPlayback() {
  if (firstVideoPlaybackTracked) return;
  firstVideoPlaybackTracked = true;

  const timeToFirstVideo = Math.round(performance.now());

  trackEvent('first_video_playback', {
    time_to_playback_ms: timeToFirstVideo,
    time_to_playback_seconds: Math.round(timeToFirstVideo / 100) / 10, // 1 decimal place
  });

  console.log(`[Analytics] First video playback: ${timeToFirstVideo}ms from page load`);
}
