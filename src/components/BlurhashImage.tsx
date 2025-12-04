// ABOUTME: Blurhash placeholder component for smooth progressive image loading
// ABOUTME: Decodes blurhash strings into blurred placeholders with fade transitions

import { useEffect, useRef, useState } from 'react';
import { decode } from 'blurhash';
import { cn } from '@/lib/utils';

interface BlurhashImageProps {
  blurhash: string;
  width?: number;
  height?: number;
  punch?: number; // Controls contrast (default: 1)
  className?: string;
  resolutionX?: number; // Canvas resolution X (default: 32)
  resolutionY?: number; // Canvas resolution Y (default: 32)
}

/**
 * Renders a blurhash as a blurred placeholder image
 * Uses canvas to decode the blurhash into pixels for display
 */
export function BlurhashImage({
  blurhash,
  width = 32,
  height = 32,
  punch = 1,
  className,
  resolutionX = 32,
  resolutionY = 32,
}: BlurhashImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Decode blurhash to pixel data
      const pixels = decode(blurhash, resolutionX, resolutionY, punch);

      // Set canvas size
      canvas.width = resolutionX;
      canvas.height = resolutionY;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError(true);
        return;
      }

      // Create ImageData from decoded pixels
      const imageData = ctx.createImageData(resolutionX, resolutionY);
      imageData.data.set(pixels);

      // Draw to canvas
      ctx.putImageData(imageData, 0, 0);
      setError(false);
    } catch (err) {
      console.error('[BlurhashImage] Failed to decode blurhash:', err);
      setError(true);
    }
  }, [blurhash, resolutionX, resolutionY, punch]);

  if (error) {
    // Return transparent div if blurhash decode fails
    return <div className={cn('bg-black/10', className)} />;
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn('w-full h-full object-cover', className)}
      style={{
        imageRendering: 'auto', // Smooth scaling
      }}
    />
  );
}

interface BlurhashPlaceholderProps {
  blurhash: string;
  className?: string;
  punch?: number;
}

/**
 * Full-size blurhash placeholder that fills its container
 * Optimized for video/image placeholders
 */
export function BlurhashPlaceholder({
  blurhash,
  className,
  punch = 1,
}: BlurhashPlaceholderProps) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <BlurhashImage
        blurhash={blurhash}
        resolutionX={32}
        resolutionY={32}
        punch={punch}
        className="w-full h-full"
      />
    </div>
  );
}

/**
 * Validates if a string is a valid blurhash
 * Blurhashes are 6+ characters using base83 encoding
 */
export function isValidBlurhash(blurhash: string | undefined | null): blurhash is string {
  if (!blurhash || typeof blurhash !== 'string') return false;
  if (blurhash.length < 6) return false;

  // Validate base83 characters (0-9, A-Z, a-z, and some special chars)
  const validChars = /^[0-9A-Za-z#$%*+,\-./:;=?@[\]^_{|}~]+$/;
  return validChars.test(blurhash);
}

/**
 * Default blurhash for Rewind branding (purple gradient)
 * Used as fallback when no blurhash is available
 */
export const DEFAULT_REWIND_BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';
