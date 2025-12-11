// ABOUTME: Cloudflare Pages Function to handle SPA routing
// ABOUTME: Returns index.html with 200 status for all routes to enable SEO

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: Record<string, unknown>;
}) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Serve .well-known files directly - don't intercept them
  if (path.startsWith('/.well-known/')) {
    return context.next();
  }

  // Try to serve the requested asset first
  const response = await context.next();

  // If the response is a 404 and not a file request (no extension or is .html),
  // serve index.html with a 200 status code
  if (response.status === 404) {
    // Check if this is a route (not a static asset)
    const hasExtension = path.includes('.') && !path.endsWith('.html');

    if (!hasExtension) {
      // Fetch index.html from the static assets
      const indexUrl = new URL('/index.html', context.request.url);
      const indexResponse = await fetch(indexUrl);

      // Return index.html with 200 status code
      return new Response(indexResponse.body, {
        status: 200,
        headers: indexResponse.headers,
      });
    }
  }

  return response;
}
