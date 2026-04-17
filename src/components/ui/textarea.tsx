import * as React from 'react';

import { cn } from '@/lib/utils';

const DEFAULT_MAX_AUTO_HEIGHT = '40svh';

function setRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
}

function resolveAutoHeight(value: number | string) {
  if (typeof value === 'number') {
    return value;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.endsWith('px')) {
    return Number.parseFloat(trimmedValue);
  }

  if (trimmedValue.endsWith('svh') || trimmedValue.endsWith('dvh') || trimmedValue.endsWith('lvh') || trimmedValue.endsWith('vh')) {
    return (window.innerHeight * Number.parseFloat(trimmedValue)) / 100;
  }

  if (trimmedValue.endsWith('rem')) {
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return rootFontSize * Number.parseFloat(trimmedValue);
  }

  const parsed = Number.parseFloat(trimmedValue);

  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autosize?: boolean;
  maxAutoHeight?: number | string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ autosize = true, className, maxAutoHeight = DEFAULT_MAX_AUTO_HEIGHT, style, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const baselineHeightRef = React.useRef<number | null>(null);

    const resizeToFit = React.useCallback(() => {
      const node = innerRef.current;

      if (!node) {
        return;
      }

      if (!autosize) {
        baselineHeightRef.current = null;
        node.style.removeProperty('height');
        node.style.removeProperty('overflow-y');
        return;
      }

      node.style.height = 'auto';

      const baselineHeight = baselineHeightRef.current ?? node.offsetHeight;
      baselineHeightRef.current = baselineHeight;

      const resolvedMaxHeight = resolveAutoHeight(maxAutoHeight);
      const nextHeight = Math.max(baselineHeight, Math.min(node.scrollHeight, resolvedMaxHeight));

      node.style.height = `${nextHeight}px`;
      node.style.overflowY = node.scrollHeight > resolvedMaxHeight ? 'auto' : 'hidden';
    }, [autosize, maxAutoHeight]);

    React.useLayoutEffect(() => {
      baselineHeightRef.current = null;
      resizeToFit();
    }, [resizeToFit, className, props.rows]);

    React.useLayoutEffect(() => {
      resizeToFit();
    }, [resizeToFit, props.defaultValue, props.value]);

    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={(node) => {
          innerRef.current = node;
          setRef(forwardedRef, node);
        }}
        style={style}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
