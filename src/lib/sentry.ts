// ABOUTME: Sentry error tracking and performance monitoring for web app
// ABOUTME: Provides crash reporting with stack traces, issue grouping, and performance metrics

import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking
 * Call this as early as possible in the app lifecycle
 */
export function initializeSentry() {
  // Only initialize in browser environment
  if (typeof window === 'undefined') return;

  // Skip in development unless explicitly enabled
  const isDev = import.meta.env.DEV;
  if (isDev && !import.meta.env.VITE_SENTRY_DEV_ENABLED) {
    console.log('[Sentry] Skipped initialization in development');
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,

    // Environment tagging
    environment: import.meta.env.MODE,

    // Release tracking - uses build time as version
    release: `divine-web@${__BUILD_DATE__}`,

    // Performance monitoring
    tracesSampleRate: isDev ? 1.0 : 0.1, // 10% in production

    // Session replay for debugging (captures what user did before crash)
    replaysSessionSampleRate: 0, // Don't record normal sessions
    replaysOnErrorSampleRate: isDev ? 1.0 : 0.5, // 50% of error sessions in prod

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Filter out noise - browser environment errors we can't fix
    ignoreErrors: [
      // Browser extensions injecting scripts
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      "Can't find variable: DarkReader",
      '__firefox__',
      'runtime.sendMessage',
      "Can't find variable: CONFIG",
      "Can't find variable: logMutedMessage",
      // Network errors that are expected
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // User aborted requests
      'AbortError',
      'The operation was aborted',
      'signal timed out',
      // Video playback errors (common, usually not actionable)
      'The play() request was interrupted',
      'NotAllowedError: The request is not allowed',
      'NotSupportedError: The operation is not supported',
      // iOS WebKit errors (WKWebView lifecycle)
      'The WKWebView was deallocated',
      // React DOM errors caused by browser extensions modifying the DOM
      "Failed to execute 'removeChild' on 'Node'",
      "Failed to execute 'insertBefore' on 'Node'",
      // IndexedDB/storage errors (privacy mode, iOS Safari, cross-origin)
      "Failed to execute 'transaction' on 'IDBDatabase'",
      'IDBFactory.open() called in an invalid security context',
      "Failed to read the 'localStorage' property from 'Window'",
      "The user denied permission to access the database",
      "Can't find variable: indexedDB",
      'Unable to open database file on disk',
      'Database deleted by request of the user',
      'The operation is insecure',
      // Firebase errors from browser extensions
      /^FirebaseError: Installations/,
      // Service worker errors in restricted contexts
      'newestWorker is null',
      'Cannot update a null/nonexistent service worker registration',
      'invalid origin',
      // Sentry SDK internal error on iOS DuckDuckGo/older browsers
      'feature named `performanceMetrics` was not found',
    ],

    // Don't send PII
    beforeSend(event) {
      // Scrub any potential PII from the event
      if (event.user) {
        // Only keep anonymized user ID (pubkey is already pseudonymous)
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });

  console.log('[Sentry] Initialized');
}

/**
 * Set the current user for Sentry (use pubkey, not personal info)
 */
export function setSentryUser(pubkey: string | null) {
  if (pubkey) {
    Sentry.setUser({ id: pubkey });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category: 'navigation' | 'user' | 'video' | 'api' | 'nostr',
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

// Re-export Sentry for direct usage (e.g., ErrorBoundary)
export { Sentry };
