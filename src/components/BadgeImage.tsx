// ABOUTME: Badge artwork renderer with a default Divine fallback when badge media is missing or broken

import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src?: string;
  alt: string;
  fallbackClassName?: string;
  fallbackInnerClassName?: string;
}

export function BadgeImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackInnerClassName,
  onError,
  ...props
}: BadgeImageProps) {
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          'overflow-hidden bg-gradient-to-br from-muted via-muted/80 to-background',
          className,
          fallbackClassName,
        )}
      >
        <div
          className={cn('h-full w-full bg-center bg-no-repeat opacity-75', fallbackInnerClassName)}
          style={{
            backgroundImage: "url('/app_icon.png')",
            backgroundSize: '64%',
          }}
        />
      </div>
    );
  }

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      onError={(event) => {
        setHasError(true);
        onError?.(event);
      }}
    />
  );
}
