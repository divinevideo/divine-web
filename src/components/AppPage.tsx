import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type AppPageWidth = 'feed' | 'default' | 'detail' | 'wide' | 'full';

const widthClassMap: Record<AppPageWidth, string> = {
  feed: 'max-w-[42rem]',
  default: 'max-w-[48rem]',
  detail: 'max-w-[52rem]',
  wide: 'max-w-[72rem]',
  full: 'max-w-[88rem]',
};

interface AppPageProps extends HTMLAttributes<HTMLElement> {
  width?: AppPageWidth;
}

interface AppPageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function AppPage({
  children,
  className,
  width = 'default',
  ...props
}: AppPageProps) {
  return (
    <section className={cn('app-page', className)} {...props}>
      <div className={cn('app-page__inner', widthClassMap[width])}>
        {children}
      </div>
    </section>
  );
}

export function AppPageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  titleClassName,
  descriptionClassName,
  ...props
}: AppPageHeaderProps) {
  return (
    <header className={cn('app-page__header', className)} {...props}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? <div className="app-eyebrow">{eyebrow}</div> : null}
          <h1 className={cn('app-title', titleClassName)}>{title}</h1>
          {description ? (
            <p className={cn('app-subtitle', descriptionClassName)}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 self-start md:pt-1">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
