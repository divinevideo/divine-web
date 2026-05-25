import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useHead, useSeoMeta } from '@unhead/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { InviteCodeForm } from '@/components/auth/InviteCodeForm';
import { setInviteHandoff } from '@/lib/authHandoff';
import { buildSignupRedirect } from '@/lib/divineLogin';
import { validateInviteCode, InviteApiError } from '@/lib/inviteApi';

const InvitesLandingPage = () => {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();

  const [inviteCode, setInviteCode] = useState(code ?? '');
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSeoMeta({
    title: code ? t('invitesLandingPage.seoTitle', { code }) : t('invitesLandingPage.seoTitleDefault'),
    description: code
      ? t('invitesLandingPage.seoDescription', { code })
      : t('invitesLandingPage.seoDescriptionDefault'),
  });

  useHead({
    meta: [
      { name: 'apple-itunes-app', content: 'app-id=6747959501' },
    ],
  });

  useEffect(() => {
    if (!code) {
      setIsValidating(false);
      setValidationError(t('loginDialog.errorInviteValidationFailed'));
      return;
    }

    let isCancelled = false;

    validateInviteCode(code)
      .then(() => {
        if (!isCancelled) {
          setInviteCode(code);
          setValidationError(null);
        }
      })
      .catch((caughtError) => {
        if (!isCancelled) {
          const message =
            caughtError instanceof InviteApiError && caughtError.inviteStatus === 'used'
              ? t('loginDialog.errorInviteCodeUsed')
              : caughtError instanceof InviteApiError && caughtError.code === 'invalid_invite'
                ? t('loginDialog.errorInviteValidationFailed')
                : caughtError instanceof Error
                  ? caughtError.message
                  : t('loginDialog.inviteUnavailable');
          setValidationError(message);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsValidating(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [code, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    setIsSubmitting(true);

    try {
      const result = await validateInviteCode(inviteCode);
      const returnPath = `${window.location.pathname}${window.location.search}`;
      setInviteHandoff({
        code: result.normalizedCode,
        mode: 'signup',
        createdAt: Date.now(),
        returnPath,
      });
      const redirect = await buildSignupRedirect({ returnPath });
      window.location.assign(redirect.url);
    } catch (caughtError) {
      setValidationError(
        caughtError instanceof Error ? caughtError.message : t('loginDialog.errorInviteValidationFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-off-white dark:bg-brand-dark-green">
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <BrandLogo className="h-12 w-auto" />
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t('invitesLandingPage.heading')}
            </h1>
            <p className="text-muted-foreground">{t('invitesLandingPage.subheading')}</p>
          </div>

          {/* Content Card */}
          <div className="rounded-2xl bg-card p-6 shadow-lg">
            {isValidating ? (
              <div className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                {t('loginDialog.checkingInvite')}
              </div>
            ) : validationError ? (
              <Alert variant="destructive">
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-4">
              <InviteCodeForm
                inputClassName="text-center text-lg font-mono tracking-widest"
                isLoading={isSubmitting || isValidating}
                onInviteCodeChange={setInviteCode}
                onSubmit={handleSubmit}
                value={inviteCode}
                waitlistEnabled={false}
              />
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-muted-foreground">
            {t('invitesLandingPage.alreadyHaveAccount')}{' '}
            <a className="font-medium text-primary hover:underline" href="https://login.divine.video">
              {t('invitesLandingPage.signIn')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvitesLandingPage;
