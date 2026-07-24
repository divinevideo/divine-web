// ABOUTME: Device-aware share for the showcase — native sheet on touch, copy on desktop
// ABOUTME: Desktop Chrome supports navigator.share, but the reel wants copy-to-clipboard there

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';

/**
 * True only where a native share sheet is the expected gesture: touch devices.
 *
 * Desktop Chrome/Edge implement `navigator.share` and would pop an OS share
 * dialog, but on desktop the intent is "copy the link so I can paste it." We
 * gate native sharing on a coarse pointer so desktop always copies instead.
 */
export function prefersNativeShare(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Share a URL the way the showcase wants: the native sheet on phones/tablets,
 * a clipboard copy (with a toast) everywhere else.
 */
export function useShowcaseShare() {
  const { toast } = useToast();

  return useCallback(
    async (data: { url: string }) => {
      if (prefersNativeShare()) {
        try {
          await navigator.share({ url: data.url });
          return; // Completed or cancelled in the OS sheet.
        } catch (error) {
          if ((error as Error).name === 'AbortError') return;
          // Any other failure falls through to the clipboard path.
        }
      }

      try {
        await navigator.clipboard.writeText(data.url);
        // Auto-dismiss the confirmation so it never needs a click. Dismiss via
        // the returned handle on a timer — the app's toasts don't auto-close on
        // their own, and this is independent of the Radix duration plumbing.
        const shown = toast({ title: 'Link copied.', description: 'Paste it wherever.' });
        window.setTimeout(() => shown.dismiss(), 2500);
      } catch {
        toast({
          title: 'Copy hit a wall.',
          description: 'Your browser blocked clipboard access. Try again?',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );
}
