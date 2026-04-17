/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build-time constants injected by Vite
declare const __BUILD_TIME__: string;
declare const __BUILD_DATE__: string;
/** package.json version, optional +VITE_BUILD_SHA from CI (see vite.config.ts) */
declare const __APP_VERSION__: string;
