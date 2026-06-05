const HUBSPOT_SCRIPT_ID = 'hs-script-loader';
const HUBSPOT_SCRIPT_SRC = 'https://js-na2.hs-scripts.com/244466832.js';

function isAnalyticsSuppressed(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.__DIVINE_ANALYTICS_DISABLED__;
}

export function loadHubSpotTracking(): void {
  if (typeof document === 'undefined') return;
  if (isAnalyticsSuppressed()) return;
  if (document.getElementById(HUBSPOT_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.id = HUBSPOT_SCRIPT_ID;
  script.async = true;
  script.defer = true;
  script.src = HUBSPOT_SCRIPT_SRC;
  document.head.appendChild(script);
}

loadHubSpotTracking();
