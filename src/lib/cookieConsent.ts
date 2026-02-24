// ABOUTME: Cookie consent bridge between HubSpot banner and app analytics
// ABOUTME: Gates Firebase Analytics behind user GDPR consent via HubSpot cookie banner API

type ConsentCallback = (consented: boolean) => void;

let analyticsConsented: boolean | null = null;
const listeners: ConsentCallback[] = [];
let initialized = false;

/**
 * Register a callback for when analytics consent changes.
 * Fires immediately if consent state is already known (return visitor).
 */
export function onAnalyticsConsentChanged(callback: ConsentCallback): void {
  listeners.push(callback);

  if (analyticsConsented !== null) {
    callback(analyticsConsented);
  }
}

/** Current analytics consent state. null = not yet determined. */
export function getAnalyticsConsent(): boolean | null {
  return analyticsConsented;
}

/**
 * Initialize the HubSpot consent listener.
 * Call once at app startup, before initializeAnalytics().
 */
export function initCookieConsent(): void {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  initialized = true;

  const _hsp = (window._hsp = window._hsp || []);

  _hsp.push([
    'addPrivacyConsentListener',
    (consent: { categories: { analytics: boolean } }) => {
      updateConsent(consent.categories.analytics);
    },
  ]);
}

function updateConsent(consented: boolean): void {
  const changed = analyticsConsented !== consented;
  analyticsConsented = consented;

  if (changed) {
    for (const listener of listeners) {
      try {
        listener(consented);
      } catch (err) {
        console.error('[CookieConsent] Listener error:', err);
      }
    }
  }
}

/** Reset module state (for tests only). */
export function _resetForTesting(): void {
  analyticsConsented = null;
  listeners.length = 0;
  initialized = false;
}
