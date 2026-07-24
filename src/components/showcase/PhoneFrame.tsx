// ABOUTME: A phone device bezel wrapping the showcase reel on larger screens
// ABOUTME: On phones the device IS the frame, so it renders full-bleed instead

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrap content in a phone-shaped bezel on tablet/desktop, giving the showcase
 * the "you're looking at the app" feel. On real phones (< sm) a bezel around
 * content the viewer is already holding in a phone would be silly, so it
 * degrades to a simple rounded, full-width surface at a portrait aspect.
 */
export function PhoneFrame({ children, className }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        // Mobile: near-full-width portrait card. sm+: fixed phone width with bezel.
        'relative mx-auto w-full max-w-[340px] sm:w-[340px]',
        // Shorter than a modern 9:19.5 handset so the whole device fits above
        // the fold on a laptop; still clearly a portrait phone.
        'aspect-[9/17]',
        // The bezel — thick dark border + chunky brand shadow, à la the sticker cards.
        'rounded-[2.5rem] border-[10px] border-brand-dark-green bg-black',
        'shadow-[0_12px_0_0_rgba(0,0,0,0.12)] sm:shadow-[10px_12px_0_0] sm:shadow-brand-dark-green/30',
        'overflow-hidden',
        className,
      )}
      data-testid="phone-frame"
    >
      {/* Speaker/camera notch — decorative, hidden from a11y. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-2 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/25"
      />
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
