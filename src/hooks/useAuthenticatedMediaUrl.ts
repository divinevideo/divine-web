import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth, useAdultVerification } from '@/hooks/useAdultVerification';

export function isProtectedDivineMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'media.divine.video';
  } catch {
    return false;
  }
}

interface UseAuthenticatedMediaUrlOptions {
  enabled?: boolean;
}

export function useAuthenticatedMediaUrl(
  url: string | null | undefined,
  options: UseAuthenticatedMediaUrlOptions = {},
): {
  mediaUrl: string | undefined;
  isLoading: boolean;
} {
  const { enabled = true } = options;
  const { isVerified, getAuthHeader } = useAdultVerification();
  const [mediaUrl, setMediaUrl] = useState<string | undefined>(url ?? undefined);
  const [isLoading, setIsLoading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const shouldAuthenticate = !!url && enabled && isVerified && isProtectedDivineMediaUrl(url);

    if (!shouldAuthenticate) {
      setMediaUrl(url ?? undefined);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let nextObjectUrl: string | null = null;

    setMediaUrl(undefined);
    setIsLoading(true);

    void (async () => {
      try {
        const authHeader = await getAuthHeader(url);
        if (!authHeader) {
          if (!cancelled) {
            setMediaUrl(undefined);
            setIsLoading(false);
          }
          return;
        }

        const response = await fetchWithAuth(url, authHeader);
        if (!response.ok) {
          throw new Error(`Failed to load media asset: ${response.status}`);
        }

        const blob = await response.blob();
        nextObjectUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        objectUrlRef.current = nextObjectUrl;
        setMediaUrl(nextObjectUrl);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setMediaUrl(undefined);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, getAuthHeader, isVerified, url]);

  useEffect(() => (
    () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }
  ), []);

  return { mediaUrl, isLoading };
}
