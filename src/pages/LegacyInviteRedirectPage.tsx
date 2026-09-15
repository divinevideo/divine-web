import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleNotch } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import { captureProductAnalyticsUtm } from '@/lib/analyticsClient';

interface LegacyInviteRedirectPageProps {
  hasUser: boolean;
  isSessionResolving: boolean;
}

export function LegacyInviteRedirectPage({
  hasUser,
  isSessionResolving,
}: LegacyInviteRedirectPageProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (isSessionResolving) {
      return;
    }

    captureProductAnalyticsUtm(window.location.search);

    if (!hasUser) {
      sessionStorage.setItem('openSignup', '1');
    }

    navigate(hasUser ? '/home' : '/', { replace: true });
  }, [hasUser, isSessionResolving, navigate]);

  if (!isSessionResolving) {
    return null;
  }

  return (
    <div
      aria-label={t('loginDialog.verifying')}
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
    >
      <CircleNotch aria-hidden="true" className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
