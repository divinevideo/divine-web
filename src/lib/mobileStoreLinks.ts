// ABOUTME: Mobile app store link helpers with regional App Store availability checks
// ABOUTME: Keeps app download URLs consistent across shell surfaces

export const DIVINE_IOS_APP_ID = '6747959501';
export const DIVINE_ANDROID_PACKAGE = 'co.openvine.app';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.openvine.app&gl=us&hl=en';

const APP_STORE_BASE = 'https://apps.apple.com/us/app/divine-video/id6747959501';
const PLAY_STORE_BASE = 'https://play.google.com/store/apps/details';

export const ZAPSTORE_URL = `https://zapstore.dev/apps/${DIVINE_ANDROID_PACKAGE}`;

export interface StoreLinks {
  appStore: string;
  playStore: string;
  zapstore: string;
}

/**
 * Build UTM-tagged download links for every distribution channel.
 *
 * `medium` identifies the surface (e.g. `family_page`, `homepage`) so
 * attribution stays distinguishable between the marketing pages and the
 * showcase homepage.
 */
export function buildStoreLinks(campaign: string, medium = 'family_page'): StoreLinks {
  const utm = new URLSearchParams({
    utm_source: 'divine_site',
    utm_medium: medium,
    utm_campaign: campaign,
  });
  const play = new URLSearchParams({ id: DIVINE_ANDROID_PACKAGE });

  return {
    appStore: `${APP_STORE_BASE}?${utm.toString()}`,
    playStore: `${PLAY_STORE_BASE}?${play.toString()}&${utm.toString()}`,
    zapstore: ZAPSTORE_URL,
  };
}

type AppleLookupResponse = {
  resultCount?: number;
  results?: Array<{
    trackViewUrl?: string;
  }>;
};

let lookupCounter = 0;

export function getPreferredAppStoreCountry(languages?: readonly string[]): string | null {
  const preferredLanguages = languages ?? (
    typeof navigator !== 'undefined'
      ? [...(navigator.languages ?? []), navigator.language].filter(Boolean)
      : []
  );

  for (const language of preferredLanguages) {
    const country = language.match(/[-_]([A-Za-z]{2})\b/)?.[1];
    if (country) {
      return country.toLowerCase();
    }
  }

  return null;
}

export function lookupAppStoreUrl(country: string): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const callbackName = `divineAppStoreLookup${Date.now()}${lookupCounter++}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      script.remove();
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };

    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      resolve(url);
    };

    const timeout = window.setTimeout(() => finish(null), 4000);

    (window as unknown as Record<string, (response: AppleLookupResponse) => void>)[callbackName] = (response) => {
      const url = response.resultCount && response.resultCount > 0
        ? response.results?.[0]?.trackViewUrl ?? null
        : null;
      finish(url);
    };

    script.async = true;
    script.onerror = () => finish(null);
    script.src = `https://itunes.apple.com/lookup?id=${DIVINE_IOS_APP_ID}&country=${encodeURIComponent(country)}&callback=${callbackName}`;

    document.head.appendChild(script);
  });
}
