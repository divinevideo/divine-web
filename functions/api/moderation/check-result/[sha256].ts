// ABOUTME: Cloudflare Pages Function proxy for moderation check-result lookups
// ABOUTME: Avoids browser CORS failures by serving AI moderation status from the same origin as divine-web

const MODERATION_SERVICE_URL = 'https://moderation-api.divine.video';

function normalizeSha256(value: string | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim().toLowerCase();
  if (trimmed.length !== 64) return null;
  return /^[0-9a-f]{64}$/.test(trimmed) ? trimmed : null;
}

export async function onRequestGet(context: {
  params: { sha256?: string };
}): Promise<Response> {
  const sha256 = normalizeSha256(context.params.sha256);
  if (!sha256) {
    return new Response(JSON.stringify({ error: 'Invalid sha256' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const upstream = await fetch(`${MODERATION_SERVICE_URL}/check-result/${sha256}`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
