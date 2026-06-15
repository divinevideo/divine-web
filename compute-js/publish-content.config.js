// ABOUTME: Publishing and server configuration for divine-web on Fastly Compute
// ABOUTME: Configures SPA fallback, static asset caching, .well-known files, and compression

/** @type {import('@fastly/compute-js-static-publish').PublishContentConfig} */
const config = {
  kvStoreName: "divine-web-content",
  rootDir: "../dist",
  excludeDirs: [
    './node_modules',
    './screenshots.local', // Large local dev screenshots - not for KV
  ],
  excludeDotFiles: true,
  includeWellKnown: true, // Required for apple-app-site-association, assetlinks.json
  contentCompression: ['br', 'gzip'],

  // Exclude large files from KV store - they should be served from a backend/CDN
  // Note: We exclude by path pattern since file size isn't available in the callback
  kvStoreAssetInclusionTest: (assetKey) => {
    // Always include the JS/CSS bundles (critical for app)
    if (assetKey.startsWith('/assets/')) {
      return true;
    }

    // Exclude PDFs
    if (assetKey.endsWith('.pdf')) {
      console.log(`Excluding PDF from KV: ${assetKey}`);
      return false;
    }

    // Exclude large image formats in specific directories
    if (assetKey.includes('/brand-assets/') && assetKey.endsWith('.png')) {
      console.log(`Excluding large brand PNG from KV: ${assetKey}`);
      return false;
    }

    // Exclude rabble headshot (large)
    if (assetKey.includes('rabble-headshot')) {
      console.log(`Excluding headshot from KV: ${assetKey}`);
      return false;
    }

    // Exclude top_1000_hashtags.json (117KB - too large for KV)
    if (assetKey.includes('top_1000_hashtags.json')) {
      console.log(`Excluding large JSON from KV: ${assetKey}`);
      return false;
    }

    // iPad screenshots now included (70-130KB each is fine for KV)

    return true;
  },

  // Server settings are saved to the KV Store per collection
  server: {
    publicDirPrefix: "",
    staticItems: ["/assets/"], // Long cache TTL for hashed assets
    allowedEncodings: ['br', 'gzip'],
    spaFile: "/index.html", // SPA fallback for client-side routing
    notFoundPageFile: "/404.html",
    autoExt: [],
    autoIndex: ["index.html", "index.htm"],
  },
};

export default config;
