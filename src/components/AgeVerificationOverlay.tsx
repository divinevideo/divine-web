// ABOUTME: Overlay component shown when video requires age verification
// ABOUTME: Displays a confirmation button that unlocks age-restricted content

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAdultVerification } from '@/hooks/useAdultVerification';
import { useCurrentUser } from '@/hooks/useCurrentUser';
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
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    confirmAdult();
    // Small delay to show feedback
    await new Promise(resolve => setTimeout(resolve, 300));
    onVerified();
  };

  // If already verified, don't show overlay
  if (isVerified) {
    onVerified();
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
          <AlertTriangle className="w-8 h-8 text-yellow-500" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">
            Age-Restricted Content
          </h3>
          <p className="text-sm text-gray-300">
            This content may not be appropriate for all audiences.
            {!user && " Sign in to verify your age."}
          </p>
        </div>

        {user ? (
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="gap-2 bg-white text-black hover:bg-gray-200"
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
        ) : (
          <p className="text-xs text-gray-400">
            Sign in to view this content
          </p>
        )}

        <p className="text-xs text-gray-500 max-w-xs">
          Your choice will be remembered for 30 days
        </p>
      </div>
    </div>
  );
}
