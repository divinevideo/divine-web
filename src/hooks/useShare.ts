// ABOUTME: React hook for sharing URLs via Web Share API with clipboard fallback
// ABOUTME: Handles navigator.share, clipboard copy, AbortError suppression, and toast notifications

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';

/** Returns a share function that tries Web Share API, then clipboard fallback. */
export function useShare() {
  const { toast } = useToast();

  const share = useCallback(async (data: { url: string }) => {
    // Web Share API (mobile browsers, some desktop)
    if (navigator.share) {
      try {
        await navigator.share({
          url: data.url,
        });
        return; // User completed or cancelled share sheet
      } catch (error) {
        if ((error as Error).name === 'AbortError') return; // User cancelled
        // Fall through to clipboard
      }
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(data.url);
      toast({
        title: 'Link copied!',
        description: 'Link has been copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy link to clipboard',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return { share };
}
