// ABOUTME: Subdomain-aware navigation hook — wraps React Router's useNavigate
// ABOUTME: On subdomains, navigates to apex domain for non-owner content

import { useNavigate, type NavigateOptions } from 'react-router-dom';
import { useCallback } from 'react';
import { getSubdomainAwareUrl } from '@/lib/subdomainLinks';

/**
 * A subdomain-aware wrapper around useNavigate.
 *
 * On subdomains, navigating to non-owner content triggers a full page
 * navigation to the apex domain instead of a client-side route change.
 *
 * Supports both string paths and numeric deltas (e.g., -1 for browser back).
 */
export function useSubdomainNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (pathOrDelta: string | number, options?: NavigateOptions & { ownerPubkey?: string | null }) => {
      // Numeric navigation (e.g., -1 for back) — always use React Router directly
      if (typeof pathOrDelta === 'number') {
        navigate(pathOrDelta);
        return;
      }

      const { ownerPubkey, ...navOptions } = options || {};
      const { href, isExternal } = getSubdomainAwareUrl(pathOrDelta, ownerPubkey);

      if (isExternal) {
        window.location.href = href;
      } else {
        navigate(href, navOptions);
      }
    },
    [navigate],
  );
}
