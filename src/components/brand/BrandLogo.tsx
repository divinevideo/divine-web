import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        // Brand-green ink on dark backgrounds (WCAG AA passes);
        // brand-dark-green on light backgrounds (WCAG AA passes).
        // Brand spec explicitly permits dark-green logotype on light.
        // Always-green would fail 4.5:1 on off-white (2.1:1 measured).
        // Callers can override via className.
        'font-extrabold tracking-tight text-brand-dark-green dark:text-brand-green',
        className,
      )}
      style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
    >
      Divine
    </span>
  );
}
