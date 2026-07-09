// ABOUTME: Hook for managing adult content verification state
// ABOUTME: Stores verification in localStorage and provides viewer auth for media requests

import { useState, useEffect, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';
import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';

const STORAGE_KEY = 'adult-verification-confirmed';
const STORAGE_EXPIRY_KEY = 'adult-verification-expiry';
const VERIFICATION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ADULT_VERIFICATION_EVENT = 'adult-verification-changed';

interface AdultVerificationState {
  isVerified: boolean;
  isLoading: boolean;
  hasSigner: boolean;
  confirmAdult: () => void;
  revokeVerification: () => void;
  getAuthHeader: (url: string, method?: string, sha256?: string) => Promise<string | null>;
}

function getStoredVerificationState(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);

  if (stored === 'true' && expiry) {
    const expiryTime = parseInt(expiry, 10);
    if (Date.now() < expiryTime) {
      return true;
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
  }

  return false;
}

function notifyVerificationChange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(ADULT_VERIFICATION_EVENT));
}

export function useAdultVerification(): AdultVerificationState {
  const [storedIsVerified, setStoredIsVerified] = useState(false);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const { signer } = useCurrentUser();

  // Protected-minor lock (#453 / support-trust-safety#175): a protected minor
  // (13-15, keycast verified_minor) must not be able to pass or retain the
  // adult gate. Gating here, at the single seam every adult-content consumer
  // reads, locks them all at once.
  const minorStatus = useProtectedMinorStatus();
  const minorLocked = minorStatus.state === 'protected';
  // Unknown only occurs for authenticated sessions (signed-out resolves to
  // not-protected), and the check was designed for #175 to fail closed on it.
  // Unknown is also exposed through isLoading for consumers that can surface
  // that state, but today's gate decisions still key off isVerified.
  const minorUnknown = !minorStatus.isKnown;

  const isVerified = !minorLocked && !minorUnknown && storedIsVerified && !!signer;
  const isLoading = isStorageLoading || minorUnknown;

  useEffect(() => {
    const syncFromStorage = () => {
      setStoredIsVerified(getStoredVerificationState());
      setIsStorageLoading(false);
    };

    const handleStorageChange = (event: Event) => {
      if (event instanceof StorageEvent && event.key && event.key !== STORAGE_KEY && event.key !== STORAGE_EXPIRY_KEY) {
        return;
      }

      syncFromStorage();
    };

    syncFromStorage();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(ADULT_VERIFICATION_EVENT, handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(ADULT_VERIFICATION_EVENT, handleStorageChange);
    };
  }, []);

  const confirmAdult = useCallback(() => {
    // Locked for protected minors; unknown fails closed (no new attestation
    // until the check resolves).
    if (minorLocked || minorUnknown) {
      return;
    }
    const expiryTime = Date.now() + VERIFICATION_DURATION_MS;
    localStorage.setItem(STORAGE_KEY, 'true');
    localStorage.setItem(STORAGE_EXPIRY_KEY, expiryTime.toString());
    setStoredIsVerified(true);
    notifyVerificationChange();
  }, [minorLocked, minorUnknown]);

  const revokeVerification = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
    setStoredIsVerified(false);
    notifyVerificationChange();
  }, []);

  // Self-heal: purge a stale stored attestation once protection is KNOWN true
  // (attested before protection landed, or a shared browser). Known-true only —
  // an adult's attestation must survive transient unknown states.
  useEffect(() => {
    if (minorLocked && getStoredVerificationState()) {
      revokeVerification();
    }
  }, [minorLocked, revokeVerification, storedIsVerified]);

  // Generate viewer auth header for a given URL (Blossom or NIP-98 depending on inputs)
  const getAuthHeader = useCallback(
    async (
      url: string,
      method: string = 'GET',
      sha256?: string,
    ): Promise<string | null> => {
      if (!signer || !isVerified) {
        return null;
      }
      return createMediaViewerAuthHeader({ signer, url, sha256, method });
    },
    [signer, isVerified],
  );

  return {
    isVerified,
    isLoading,
    hasSigner: !!signer,
    confirmAdult,
    revokeVerification,
    getAuthHeader,
  };
}

/**
 * Check if a URL returned a 401/403 by making a HEAD request
 */
export async function checkMediaAuth(url: string): Promise<{ authorized: boolean; status: number }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'cors',
    });
    return {
      authorized: response.ok,
      status: response.status
    };
  } catch {
    // Network error or CORS issue - assume authorized and let video element handle it
    return { authorized: true, status: 0 };
  }
}

/**
 * Fetch media with NIP-98 authentication
 */
export async function fetchWithAuth(
  url: string,
  authHeader: string | null,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
