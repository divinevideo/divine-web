// ABOUTME: Custom HLS.js loader that adds NIP-98 auth headers to each request
// ABOUTME: Generates fresh signatures for each segment/manifest request

import Hls, { type HlsConfig, type LoaderContext, type LoaderConfiguration, type LoaderCallbacks, type Loader } from 'hls.js';

type AuthHeaderGenerator = (url: string, method?: string) => Promise<string | null>;

// Type for the loader constructor as expected by HlsConfig
type LoaderConstructor = new (config: HlsConfig) => Loader<LoaderContext>;

/**
 * Creates a custom HLS loader class that adds NIP-98 auth headers to each request
 */
export function createAuthLoader(getAuthHeader: AuthHeaderGenerator): LoaderConstructor {
  // Get the default loader class from HLS.js
  const DefaultLoader = Hls.DefaultConfig.loader;

  return class AuthLoader extends DefaultLoader {
    private authHeaderGenerator: AuthHeaderGenerator;

    constructor(config: HlsConfig) {
      super(config);
      this.authHeaderGenerator = getAuthHeader;
    }

    load(
      context: LoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>
    ): void {
      // Generate auth header for this specific URL (fire and forget, then call parent)
      this.authHeaderGenerator(context.url, 'GET')
        .then((authHeader) => {
          if (authHeader) {
            // Add auth header to the request
            if (!context.headers) {
              context.headers = {};
            }
            context.headers['Authorization'] = authHeader;
          }
        })
        .catch((error) => {
          console.error('[AuthLoader] Failed to generate auth header:', error);
        })
        .finally(() => {
          // Call the parent loader after setting up headers
          super.load(context, config, callbacks);
        });
    }
  };
}
