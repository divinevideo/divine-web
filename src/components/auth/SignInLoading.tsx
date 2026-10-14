// ABOUTME: Loading state for a logged-in-only page while saved sign-in is still loading
// ABOUTME: Shown in place of the page, and of the not-found page, until the account is known

import { CircleNotch } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

export function SignInLoading() {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t('loginDialog.verifying')}
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
    >
      <CircleNotch aria-hidden="true" className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
