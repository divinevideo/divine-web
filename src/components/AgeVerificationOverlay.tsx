// ABOUTME: Overlay component shown when video requires age verification
// ABOUTME: Displays a confirmation button that unlocks age-restricted content

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Warning as AlertTriangle, ShieldCheck } from '@phosphor-icons/react';
import { useAdultVerification } from '@/hooks/useAdultVerification';
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
  const { confirmAdult, isVerified } = useAdultVerification();
  const { user } = useCurrentUser();
  const { openLoginDialog } = useLoginDialog();
  const [isConfirming, setIsConfirming] = useState(false);
  const hasCalledOnVerified = useRef(false);
  const isConfirmingRef = useRef(false);

  const handleConfirm = () => {
    // Prevent double-clicks
    if (isConfirmingRef.current) return;
    
    isConfirmingRef.current = true;
    setIsConfirming(true);
    confirmAdult();
    
    // Call onVerified synchronously with guard to prevent multiple calls
    if (!hasCalledOnVerified.current) {
      hasCalledOnVerified.current = true;
      onVerified();
    }
  };

  // If already verified on mount, call onVerified once
  // This handles the case where user is already verified from localStorage
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
              <h3 className="text-lg font-semibold text-white">Age-Restricted Content</h3>
              <p className="text-sm text-gray-300">
                This content may not be appropriate for all audiences.
              </p>
            </div>
            <Button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="gap-2 bg-white text-black hover:bg-gray-200 touch-manipulation"
            >
              {isConfirming ? (
                <>Verifying...</>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  I'm 18 or older
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 max-w-xs">
              Your choice will be remembered for 30 days
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Sign in to view this content</h3>
              <p className="text-sm text-gray-300">
                This content is age-restricted. Sign in so we can confirm your age and load the video.
              </p>
            </div>
            <Button
              onClick={openLoginDialog}
              className="gap-2 bg-white text-black hover:bg-gray-200 touch-manipulation"
            >
              Sign in
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
