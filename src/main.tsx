/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Initialize Sentry FIRST for error tracking
import { initializeSentry } from './lib/sentry';
initializeSentry();

import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

// Initialize Firebase Analytics and Performance Monitoring
import { initializeAnalytics } from './lib/analytics';
initializeAnalytics();

import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

// Import custom fonts
import '@fontsource-variable/inter';
import '@fontsource/pacifico';

// PWA Service Worker Registration (managed by VitePWA)
import { registerSW } from 'virtual:pwa-register';

registerSW({
  onRegistered(registration) {
    if (registration) {
      // Check for updates every hour
      setInterval(() => registration.update(), 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('[PWA] Service Worker registration failed:', error);
  },
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
