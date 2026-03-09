import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

type AvatarTone = 'auto' | 'image' | 'yellow' | 'lime' | 'pink' | 'orange' | 'violet' | 'purple' | 'blue';
type AvatarSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

type AvatarContextValue = {
  size: AvatarSize;
  tone?: AvatarTone;
};

const AvatarContext = React.createContext<AvatarContextValue>({
  size: 'md',
});

const sizeClasses: Record<AvatarSize, string> = {
  '2xs': 'h-4 w-4 rounded-[6px]',
  xs: 'h-6 w-6 rounded-lg',
  sm: 'h-8 w-8 rounded-[12px]',
  md: 'h-10 w-10 rounded-2xl',
  lg: 'h-12 w-12 rounded-[20px]',
  xl: 'h-14 w-14 rounded-[22px]',
  '2xl': 'h-20 w-20 rounded-[28px]',
};

const overlayClasses: Record<AvatarSize, string> = {
  '2xs': '-bottom-0.5 -right-0.5 h-3 w-3',
  xs: '-bottom-0.5 -right-0.5 h-4 w-4',
  sm: '-bottom-1 -right-1 h-4 w-4',
  md: '-bottom-1 -right-1 h-5 w-5',
  lg: '-bottom-1 -right-1 h-5 w-5',
  xl: '-bottom-1 -right-1 h-5 w-5',
  '2xl': 'bottom-0 right-0 h-6 w-6',
};

const overlayIconClasses: Record<AvatarSize, string> = {
  '2xs': 'h-2 w-2',
  xs: 'h-2.5 w-2.5',
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3 w-3',
  xl: 'h-3 w-3',
  '2xl': 'h-3.5 w-3.5',
};

const fallbackTextClasses: Record<AvatarSize, string> = {
  '2xs': 'text-[8px]',
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
  xl: 'text-base',
  '2xl': 'text-lg',
};

const toneStyles = {
  yellow: {
    background: 'hsl(var(--brand-yellow))',
    headFrom: '#c4ba00',
    headTo: 'hsl(var(--brand-yellow-dark))',
    bodyFrom: '#b7ad00',
    bodyTo: 'hsl(var(--brand-yellow-dark))',
  },
  lime: {
    background: 'hsl(var(--brand-lime))',
    headFrom: '#84b400',
    headTo: 'hsl(var(--brand-lime-dark))',
    bodyFrom: '#78a300',
    bodyTo: 'hsl(var(--brand-lime-dark))',
  },
  pink: {
    background: 'hsl(var(--brand-pink))',
    headFrom: '#d4548a',
    headTo: 'hsl(var(--brand-pink-dark))',
    bodyFrom: '#c6477a',
    bodyTo: 'hsl(var(--brand-pink-dark))',
  },
  orange: {
    background: 'hsl(var(--brand-orange))',
    headFrom: '#db500d',
    headTo: 'hsl(var(--brand-orange-dark))',
    bodyFrom: '#c94508',
    bodyTo: 'hsl(var(--brand-orange-dark))',
  },
  violet: {
    background: 'hsl(var(--brand-violet))',
    headFrom: '#7174cf',
    headTo: 'hsl(var(--brand-violet-dark))',
    bodyFrom: '#6467bc',
    bodyTo: 'hsl(var(--brand-violet-dark))',
  },
  purple: {
    background: 'hsl(var(--brand-purple))',
    headFrom: '#6a49f0',
    headTo: 'hsl(var(--brand-purple-dark))',
    bodyFrom: '#5738d8',
    bodyTo: 'hsl(var(--brand-purple-dark))',
  },
  blue: {
    background: 'hsl(var(--brand-blue))',
    headFrom: '#1692c8',
    headTo: 'hsl(var(--brand-blue-dark))',
    bodyFrom: '#0d84b7',
    bodyTo: 'hsl(var(--brand-blue-dark))',
  },
} as const;

type ResolvedTone = keyof typeof toneStyles;

function getTextContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join('');
  }

  if (React.isValidElement(node)) {
    return getTextContent(node.props.children);
  }

  return '';
}

function getFallbackTone(text: string): ResolvedTone {
  const tones = Object.keys(toneStyles) as ResolvedTone[];

  if (!text) {
    return 'lime';
  }

  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) % tones.length;
  }

  return tones[Math.abs(hash) % tones.length];
}

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  size?: AvatarSize;
  tone?: AvatarTone;
  showFollow?: boolean;
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size = 'md', tone, showFollow = false, children, ...props }, ref) => (
  <AvatarContext.Provider value={{ size, tone }}>
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex shrink-0 overflow-hidden border border-white/25 bg-brand-dark-green shadow-[0.4px_0.4px_0.6px_rgba(0,0,0,0.1),1px_1px_1px_rgba(0,0,0,0.1)]',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
      {showFollow && (
        <span
          className={cn(
            'absolute z-20 flex items-center justify-center rounded-full border border-brand-dark-green/60 bg-primary text-primary-foreground shadow-[0.4px_0.4px_0.6px_rgba(0,0,0,0.1),1px_1px_1px_rgba(0,0,0,0.1)]',
            overlayClasses[size],
          )}
        >
          <Plus className={overlayIconClasses[size]} strokeWidth={3} />
        </span>
      )}
    </AvatarPrimitive.Root>
  </AvatarContext.Provider>
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('h-full w-full rounded-[inherit] object-cover', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

export interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  tone?: AvatarTone;
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, children, tone, ...props }, ref) => {
  const { size, tone: inheritedTone } = React.useContext(AvatarContext);
  const label = getTextContent(children).trim();
  const resolvedTone = (tone && tone !== 'auto' ? tone : inheritedTone && inheritedTone !== 'auto' ? inheritedTone : getFallbackTone(label)) as ResolvedTone;
  const palette = toneStyles[resolvedTone];
  const hasCustomFallback = React.Children.toArray(children).some((child) => React.isValidElement(child));

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit] text-brand-dark-green',
        fallbackTextClasses[size],
        className,
      )}
      {...props}
    >
      <span
        className="absolute inset-0 rounded-[inherit]"
        style={{
          backgroundColor: palette.background,
          backgroundImage: 'radial-gradient(circle at 24% 20%, rgba(255,255,255,0.32), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.12), transparent 52%)',
        }}
      />
      <span
        className="absolute left-1/2 top-[18%] h-[38%] w-[38%] -translate-x-1/2 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
        style={{
          backgroundImage: `linear-gradient(180deg, ${palette.headFrom} 0%, ${palette.headTo} 100%)`,
        }}
      />
      <span
        className="absolute bottom-[-8%] left-1/2 h-[54%] w-[82%] -translate-x-1/2 rounded-[999px_999px_28%_28%/85%_85%_18%_18%] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
        style={{
          backgroundImage: `linear-gradient(180deg, ${palette.bodyFrom} 0%, ${palette.bodyTo} 100%)`,
        }}
      />
      {hasCustomFallback ? (
        <span className="relative z-10 flex items-center justify-center text-current">{children}</span>
      ) : (
        <span className="sr-only">{label || 'User avatar'}</span>
      )}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
export type { AvatarSize, AvatarTone };
