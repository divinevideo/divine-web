import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(() => ({
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
VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: false
      },
      workbox: {
        // Disable all caching - network only
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: null,
        runtimeCaching: []
      },
      includeAssets: [
        'app_icon.avif',
        'og.avif',
        'no-ai-icon.svg',
        'divine_icon_transparent.avif',
        'browserconfig.xml'
      ],
      manifest: {
        name: 'diVine Web - Short-form Looping Videos',
        short_name: 'diVine',
        description: 'Watch and share 6-second looping videos on the decentralized Nostr network.',
        theme_color: '#00b488',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['entertainment', 'video', 'social'],
        screenshots: [
          {
            src: '/screenshots/iPad 13 inch-0.avif',
            sizes: '2048x2732',
            type: 'image/avif',
            form_factor: 'wide'
          },
          {
            src: '/screenshots/iPad 13 inch-1.avif',
            sizes: '2048x2732',
            type: 'image/avif',
            form_factor: 'wide'
          },
          {
            src: '/screenshots/iPad 13 inch-2.avif',
            sizes: '2048x2732',
            type: 'image/avif',
            form_factor: 'wide'
          }
        ],
        icons: [
          {
            src: 'app_icon.avif',
            sizes: '256x256',
            type: 'image/avif',
            purpose: 'any'
          },
          {
            src: 'app_icon.avif',
            sizes: '256x256 512x512',
            type: 'image/avif',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
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
    },
  },
}));