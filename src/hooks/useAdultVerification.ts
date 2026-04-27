// ABOUTME: Hook for managing adult content verification state
// ABOUTME: Stores verification in localStorage and provides viewer auth for media requests

import { useState, useEffect, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';
import { clearAnonymousSigner, getOrCreateAnonymousSigner } from '@/lib/ephemeralSigner';

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
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { signer } = useCurrentUser();

  useEffect(() => {
    const syncFromStorage = () => {
      setIsVerified(getStoredVerificationState());
      setIsLoading(false);
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
    const expiryTime = Date.now() + VERIFICATION_DURATION_MS;
    localStorage.setItem(STORAGE_KEY, 'true');
    localStorage.setItem(STORAGE_EXPIRY_KEY, expiryTime.toString());
    setIsVerified(true);
    notifyVerificationChange();
  }, []);

  const revokeVerification = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
    clearAnonymousSigner();
    setIsVerified(false);
    notifyVerificationChange();
  }, []);

  // Generate viewer auth header for a given URL (Blossom or NIP-98 depending on inputs).
  // Prefers the logged-in user's signer; falls back to a device-scoped anonymous signer
  // once the viewer has confirmed adult content.
  const getAuthHeader = useCallback(
    async (
      url: string,
      method: string = 'GET',
      sha256?: string,
    ): Promise<string | null> => {
      if (!isVerified) {
        return null;
      }
      const effectiveSigner = signer ?? getOrCreateAnonymousSigner();
      return createMediaViewerAuthHeader({ signer: effectiveSigner, url, sha256, method });
    },
    [signer, isVerified],
  );

  return {
    isVerified,
    isLoading,
    hasSigner: !!signer || isVerified,
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
