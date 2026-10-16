// ABOUTME: Warning shown in place of results when search input looks like a secret key
// ABOUTME: Shared by the search page and the follower/following list search

import { useTranslation } from 'react-i18next';
import { WarningCircle } from '@phosphor-icons/react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export function SecretKeySearchWarning({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <Alert className={cn('border-brand-orange/50 bg-brand-orange/10', className)}>
      <WarningCircle className="h-5 w-5" weight="fill" />
      <AlertDescription>{t('secretKeySearchWarning.message')}</AlertDescription>
    </Alert>
  );
}
