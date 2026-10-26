// ABOUTME: Overlay component shown when video requires age verification
// ABOUTME: Displays a confirmation button that unlocks age-restricted content

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Warning as AlertTriangle, ShieldCheck } from '@phosphor-icons/react';
import { useAdultVerification } from '@/hooks/useAdultVerification';
import { useAgeConfirmationFeedback } from '@/hooks/useAgeConfirmationFeedback';
import { useAgeRestrictedPreference } from '@/hooks/useAgeRestrictedPreference';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { cn } from '@/lib/utils';

interface AgeVerificationOverlayProps {
  onVerified: () => void;
  className?: string;
  thumbnailUrl?: string;
  blurhash?: string;
}

export function AgeVerificationOverlay({
  onVerified,
  className,
  thumbnailUrl,
  blurhash: _blurhash,
}: AgeVerificationOverlayProps) {
  const { t } = useTranslation();
  const { confirmAdult, isVerified, isLoading, isProtectedMinor } = useAdultVerification();
  const { hideAgeRestricted, setHideAgeRestricted } = useAgeRestrictedPreference();
  const { user } = useCurrentUser();
  const { openLoginDialog } = useLoginDialog();
  const { confirmFor, failedFor } = useAgeConfirmationFeedback(confirmAdult, `${user?.pubkey ?? ''}:${isLoading}:${isProtectedMinor}`);
  const confirmationFailed = failedFor('overlay');
  const hasCalledOnVerified = useRef(false);

  const handleConfirm = () => {
    confirmFor('overlay');
  };

  // Advance once when verification becomes effective, including after confirmation.
  useEffect(() => {
    if (isVerified && !hasCalledOnVerified.current) {
      hasCalledOnVerified.current = true;
      onVerified();
    }
  }, [isVerified, onVerified]);

  // If already verified, don't show overlay
  if (isVerified) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center",
        "bg-black/80 backdrop-blur-sm",
        className
      )}
    >
      {/* Blurred background thumbnail if available */}
      {thumbnailUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl"
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
          {user ? (
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          ) : (
            <ShieldCheck className="w-8 h-8 text-yellow-500" />
          )}
        </div>

        {user ? (
          <>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">{t('ageVerificationOverlay.restrictedHeading')}</h3>
              <p className="text-sm text-gray-300">
                {t('ageVerificationOverlay.restrictedBody')}
              </p>
            </div>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || isProtectedMinor}
              className="gap-2 bg-white text-black hover:bg-gray-200 touch-manipulation"
            >
              {isLoading ? (
                <>{t('ageVerificationOverlay.checkingAgeStatus')}</>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  {t('ageVerificationOverlay.confirmButton')}
                </>
              )}
            </Button>
            {isProtectedMinor && <p className="text-sm text-gray-300">{t('ageVerificationOverlay.unavailableForAccount')}</p>}
            {confirmationFailed && <p role="alert" className="text-sm text-gray-300">{t('ageVerificationOverlay.confirmationFailed')}</p>}
            <p className="text-xs text-gray-500 max-w-xs">
              {t('ageVerificationOverlay.rememberNote')}
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">{t('ageVerificationOverlay.signInHeading')}</h3>
              <p className="text-sm text-gray-300">
                {t('ageVerificationOverlay.signInBody')}
              </p>
            </div>
            <Button
              onClick={openLoginDialog}
              className="gap-2 bg-white text-black hover:bg-gray-200 touch-manipulation"
            >
              {t('ageVerificationOverlay.signInButton')}
            </Button>
          </>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setHideAgeRestricted(!hideAgeRestricted)}
        className="relative z-10 text-white hover:bg-white/10 hover:text-white"
      >
        {hideAgeRestricted
          ? t('moderationSettings.showAgeRestrictedVideos')
          : t('ageVerificationOverlay.hideVideos')}
      </Button>
    </div>
  );
}
