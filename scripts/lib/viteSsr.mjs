// ABOUTME: Runs a callback with a short-lived Vite SSR loader rooted at the repo, for build scripts on Node 20
// ABOUTME: ws:false avoids Vite's fixed HMR port so parallel invocations (tests) cannot collide

export async function withViteSsr(root, fn) {
  const { createServer } = await import('vite'); // lazy: importers that never call this stay light
  const vite = await createServer({
    root,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, // SSR loading never needs client pre-bundling
  });
  try {
    return await fn((id) => vite.ssrLoadModule(id));
  } finally {
    await vite.close();
  }
}
