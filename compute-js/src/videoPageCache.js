// ABOUTME: KV stale-while-revalidate handler for edge-rendered video pages
// ABOUTME: Purges cached entries on definite 404/410 takedowns while serving stale only on transient errors

const VIDEO_PAGE_CACHE_TTL_SECONDS = 300;
const VIDEO_PAGE_STALE_MAX_AGE_SECONDS = 3600;
const VIDEO_PAGE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

/**
 * Render and cache an edge video page with stale-while-revalidate semantics.
 *
 * Definite 404/410 responses from Funnelcake purge the KV entry immediately so
 * taken-down videos are not kept alive for the stale window, while 5xx/network
 * failures fall back to stale HTML during upstream outages.
 */
export async function resolveCachedVideoPage({
  videoId,
  staticAssets,
  contentStore,
  fetchVideoMetadataWithStatus,
  renderVideoPage,
  createHeaders,
  waitUntil,
  nowSeconds = () => Math.floor(Date.now() / 1000),
}) {
  const CACHE_KEY = `page:video:${videoId}`;

  let staleEntry = null;

  // 1. Check KV page cache
  try {
    const cached = await contentStore.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(await cached.text());
      const age = nowSeconds() - parsed.timestamp;
      if (parsed.assetMainJs === staticAssets.mainJs) {
        if (age < VIDEO_PAGE_CACHE_TTL_SECONDS) {
          return new Response(parsed.html, {
            status: 200,
            headers: createHeaders({
              cacheControl: VIDEO_PAGE_CACHE_CONTROL,
              noindex: Boolean(parsed.ageRestricted),
            }),
          });
        }
        if (age < VIDEO_PAGE_STALE_MAX_AGE_SECONDS && parsed.html) {
          staleEntry = {
            html: parsed.html,
            ageRestricted: Boolean(parsed.ageRestricted),
          };
        }
      }
    }
  } catch (e) {
    console.error('Video page cache read error:', e.message);
  }

  const deleteStaleEntry = async () => {
    if (typeof contentStore.delete !== 'function') return;
    try {
      await contentStore.delete(CACHE_KEY);
    } catch (e) {
      console.error('Video page cache delete error:', e.message);
    }
  };

  const refreshVideoPage = async (isBackground = false) => {
    let lookup;
    try {
      lookup = await fetchVideoMetadataWithStatus(videoId);
    } catch (e) {
      console.error('Failed to fetch video metadata:', e.message);
      lookup = { status: 'error' };
    }

    if (lookup.status === 'not_found') {
      // Definite takedown/removal: purge cached HTML so subsequent requests
      // fall through to the SPA instead of serving a removed video for an hour.
      await deleteStaleEntry();
      return { status: 'not_found' };
    }

    if (lookup.status !== 'ok' || !lookup.meta) {
      return { status: 'error' };
    }

    const ageRestricted = Boolean(lookup.meta.age_restricted);
    const html = renderVideoPage({ video: lookup.meta, videoId, staticAssets });

    const putPromise = contentStore.put(CACHE_KEY, JSON.stringify({
      html,
      timestamp: nowSeconds(),
      assetMainJs: staticAssets.mainJs,
      ageRestricted,
    })).catch((e) => {
      console.error('Video page cache write error:', e.message);
    });

    if (!isBackground && typeof waitUntil === 'function') {
      waitUntil(putPromise);
    } else {
      await putPromise;
    }

    return { status: 'ok', html, ageRestricted };
  };

  if (staleEntry && typeof waitUntil === 'function') {
    waitUntil(refreshVideoPage(true).catch((e) => {
      console.error(`Background video page refresh failed for ${videoId}:`, e.message);
    }));
    return new Response(staleEntry.html, {
      status: 200,
      headers: createHeaders({
        cacheControl: VIDEO_PAGE_CACHE_CONTROL,
        noindex: staleEntry.ageRestricted,
      }),
    });
  }

  const refreshed = await refreshVideoPage(false);
  if (refreshed.status === 'ok') {
    return new Response(refreshed.html, {
      status: 200,
      headers: createHeaders({
        cacheControl: VIDEO_PAGE_CACHE_CONTROL,
        noindex: refreshed.ageRestricted,
      }),
    });
  }

  if (refreshed.status === 'error' && staleEntry) {
    return new Response(staleEntry.html, {
      status: 200,
      headers: createHeaders({
        cacheControl: VIDEO_PAGE_CACHE_CONTROL,
        noindex: staleEntry.ageRestricted,
      }),
    });
  }

  return null;
}
