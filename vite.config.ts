import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { configDefaults, defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
  },
  preview: {
    host: "::",
    port: 4173,
    allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1'],
  },
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1'],
    proxy: {
      // Proxy CDN requests to avoid CORS issues in development
      '/cdn-proxy': {
        target: 'https://cdn.divine.video',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cdn-proxy/, ''),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/api/moderation/check-result': {
        target: 'https://moderation-api.divine.video',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/moderation\/check-result/, '/check-result'),
        secure: true,
      },
    },
  },
  build: {
    // Enable source maps for better debugging
    sourcemap: false, // Disable in production for smaller builds
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/]
    }
  },
  plugins: [
    react(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: [...configDefaults.exclude, '**/.worktrees/**', '**/worktrees/**', 'tests/visual/**'],
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Fastly virtual modules — not available outside the Fastly runtime;
      // tests that import them must vi.mock() the module in the test file.
      "fastly:kv-store": path.resolve(__dirname, "./compute-js/src/__mocks__/fastly-kv-store.js"),
    },
  },
}));
