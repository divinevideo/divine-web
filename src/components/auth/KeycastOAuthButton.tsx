// ABOUTME: Primary login button that initiates OAuth flow with Keycast
// ABOUTME: Prominent CTA for new users, uses login.divine.video for auth

import { Cloud, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOAuthLogin } from '@/hooks/useOAuthLogin';

interface KeycastOAuthButtonProps {
  onStartLogin?: () => void;
  className?: string;
}

export function KeycastOAuthButton({ onStartLogin, className }: KeycastOAuthButtonProps) {
  const { startOAuthLogin, isLoading, error } = useOAuthLogin();

  const handleClick = async () => {
    onStartLogin?.();
    await startOAuthLogin();
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={isLoading}
        className={`w-full rounded-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 ${className}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Redirecting...
          </>
        ) : (
          <>
            <Cloud className="w-5 h-5 mr-2" />
            Continue with Keycast
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
