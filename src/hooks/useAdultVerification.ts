// ABOUTME: Hook for managing adult content verification state
// ABOUTME: Stores verification in localStorage and provides NIP-98 auth for media requests

import { useState, useEffect, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { NIP98 } from '@nostrify/nostrify';

const STORAGE_KEY = 'adult-verification-confirmed';
const STORAGE_EXPIRY_KEY = 'adult-verification-expiry';
const VERIFICATION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface AdultVerificationState {
  isVerified: boolean;
  isLoading: boolean;
  hasSigner: boolean;
  confirmAdult: () => void;
  revokeVerification: () => void;
  getAuthHeader: (url: string, method?: string) => Promise<string | null>;
}

export function useAdultVerification(): AdultVerificationState {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useCurrentUser();
  const signer = user?.signer;

  // Check localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);

    if (stored === 'true' && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        setIsVerified(true);
      } else {
        // Expired, clean up
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_EXPIRY_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const confirmAdult = useCallback(() => {
    const expiryTime = Date.now() + VERIFICATION_DURATION_MS;
    localStorage.setItem(STORAGE_KEY, 'true');
    localStorage.setItem(STORAGE_EXPIRY_KEY, expiryTime.toString());
    setIsVerified(true);
  }, []);

  const revokeVerification = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
    setIsVerified(false);
  }, []);

  // Generate NIP-98 auth header for a given URL
  const getAuthHeader = useCallback(async (url: string, method: string = 'GET'): Promise<string | null> => {
    if (!signer || !isVerified) {
      return null;
    }

    try {
      // Create a mock Request object for NIP-98 template
      const request = new Request(url, { method });

      // Generate NIP-98 event template
      const template = await NIP98.template(request);

      // Sign the event
      const signedEvent = await signer.signEvent(template);

      // Encode as base64 for Authorization header
      const encoded = btoa(JSON.stringify(signedEvent));
      return `Nostr ${encoded}`;
    } catch (error) {
      console.error('[useAdultVerification] Failed to generate auth header:', error);
      return null;
    }
  }, [signer, isVerified]);

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
