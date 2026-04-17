import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        'font-extrabold tracking-tight text-brand-green',
        className,
      )}
      style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
    >
      Divine
    </span>
  );
}
