/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Capture auth-entry hashes before React renders (and the router redirects strip them).
// ESM imports are hoisted above this code, but no import touches location.hash —
// the router only runs when React mounts, so sessionStorage is set in time.
if (window.location.hash === '#signup' || window.location.hash === '#login') {
  sessionStorage.setItem('openInviteAuth', '1');
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

// Initialize Sentry FIRST for error tracking
import { initializeSentry } from './lib/sentry';
initializeSentry();

// Hydrate login state from cross-subdomain cookie (before React renders)
import { hydrateLoginFromCookie } from '@/lib/crossSubdomainAuth';
hydrateLoginFromCookie();

import { createRoot } from 'react-dom/client';
import { IconContext } from '@phosphor-icons/react';
import { initializeI18n } from '@/lib/i18n';
import { cleanupServiceWorkersAndCaches } from '@/lib/serviceWorkerCleanup';

// Import polyfills first
import './lib/polyfills.ts';

initializeI18n();

// Initialize cookie consent listener (must be before analytics)
import { initCookieConsent } from './lib/cookieConsent';
initCookieConsent();

// Initialize Firebase Analytics and Performance Monitoring
// (gated behind GDPR cookie consent from HubSpot banner)
import { initializeAnalytics } from './lib/analytics';
initializeAnalytics();

import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

// Import custom fonts
import '@fontsource-variable/inter';

if ('serviceWorker' in navigator || 'caches' in window) {
  window.addEventListener('load', () => {
    void cleanupServiceWorkersAndCaches();
  });
}

initializeI18n().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      {/* Phosphor Icons default to weight="regular" (1.5px stroke); we set
          weight="bold" app-wide so icons approximate the visual heft of the
          Lucide defaults we migrated from. Per-icon overrides (e.g.
          weight="fill" for active liked hearts) still work. */}
      <IconContext.Provider value={{ weight: 'bold', mirrored: false }}>
        <App />
      </IconContext.Provider>
    </ErrorBoundary>
  );
});
