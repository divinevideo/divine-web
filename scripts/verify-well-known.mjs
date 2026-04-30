// ABOUTME: Verifies deep-link association files are reachable and valid JSON.
// ABOUTME: Smoke check for .well-known apple-app-site-association and assetlinks.json.

const baseUrl = process.argv[2] || 'https://divine.video';

async function fetchJson(pathname) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${url.toString()} returned ${response.status}: ${body.slice(0, 200)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`${url.toString()} returned unexpected Content-Type: ${contentType}`);
  }

  let json;
  try {
    json = JSON.parse(body);
  } catch (error) {
    throw new Error(`${url.toString()} returned invalid JSON: ${error.message}`);
  }

  return { url: url.toString(), json };
}

function assertInviteRoute(aasa) {
  const components = aasa?.applinks?.details?.[0]?.components;
  if (!Array.isArray(components)) {
    throw new Error('AASA missing applinks.details[0].components array');
  }

  const hasInvite = components.some((component) => component?.['/'] === '/invite/*');
  if (!hasInvite) {
    throw new Error('AASA does not include /invite/* component');
  }
}

function assertAssetLinks(assetLinks) {
  if (!Array.isArray(assetLinks) || assetLinks.length === 0) {
    throw new Error('assetlinks.json must be a non-empty array');
  }

  const hasOpenvineTarget = assetLinks.some((entry) => entry?.target?.package_name === 'co.openvine.app');
  if (!hasOpenvineTarget) {
    throw new Error('assetlinks.json does not include co.openvine.app target');
  }
}

async function main() {
  const aasa = await fetchJson('/.well-known/apple-app-site-association');
  assertInviteRoute(aasa.json);

  const assetLinks = await fetchJson('/.well-known/assetlinks.json');
  assertAssetLinks(assetLinks.json);

  console.log(`OK ${aasa.url}`);
  console.log(`OK ${assetLinks.url}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
