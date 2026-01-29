// ABOUTME: Debug utility for conditional logging only on localhost
// ABOUTME: Prevents debug logs from appearing in production

/**
 * Check if we're running on localhost or dev environment
 */
export const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.startsWith('192.168.') ||
   window.location.hostname.startsWith('10.') ||
   window.location.hostname.includes('shakespeare') ||
   window.location.hostname.includes('local'));

/**
 * Enable verbose logging (video playback, visibility updates, etc.)
 * Set to true to see detailed video playback logs
 */
export const ENABLE_VERBOSE_LOGGING = false;

/**
 * Debug log that only outputs on localhost
 */
export const debugLog = (...args: unknown[]) => {
  if (isLocalhost) {
    console.log(...args);
  }
};

/**
 * Verbose debug log for really detailed/spammy logs
 * Only outputs when ENABLE_VERBOSE_LOGGING is true
 */
export const verboseLog = (...args: unknown[]) => {
  if (isLocalhost && ENABLE_VERBOSE_LOGGING) {
    console.log(...args);
  }
};

/**
 * Debug error that only outputs on localhost
 */
export const debugError = (...args: unknown[]) => {
  if (isLocalhost) {
    console.error(...args);
  }
};

/**
 * Debug warn that only outputs on localhost
 */
export const debugWarn = (...args: unknown[]) => {
  if (isLocalhost) {
    console.warn(...args);
  }
};