// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { useState, useEffect } from 'react';
import { User, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import LoginDialog from './LoginDialog';
import SignupDialog from './SignupDialog';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { AccountSwitcher } from './AccountSwitcher';
import { cn } from '@/lib/utils';
import { useLoginDialog } from '@/contexts/LoginDialogContext';

export interface LoginAreaProps {
  className?: string;
}

export function LoginArea({ className }: LoginAreaProps) {
  const { currentUser } = useLoggedInAccounts();
  const { isOpen: globalLoginDialogOpen, closeLoginDialog } = useLoginDialog();
  const [localLoginDialogOpen, setLocalLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);

  // Open signup dialog via #signup deep link (captured in main.tsx before router redirects)
  useEffect(() => {
    if (sessionStorage.getItem('openSignup')) {
      sessionStorage.removeItem('openSignup');
      setSignupDialogOpen(true);
    }
  }, []);

  // Combine global and local dialog open states
  const loginDialogOpen = globalLoginDialogOpen || localLoginDialogOpen;

  // When local dialog closes, also close global dialog
  const handleCloseLoginDialog = () => {
    setLocalLoginDialogOpen(false);
    closeLoginDialog();
  };

  const handleLogin = () => {
    handleCloseLoginDialog();
    setSignupDialogOpen(false);
  };

  return (
    <div className={cn("inline-flex items-center justify-center gap-2", className)}>
      {currentUser ? (
        <AccountSwitcher onAddAccountClick={() => setLocalLoginDialogOpen(true)} />
      ) : (
        <>
          <Button
            onClick={() => setLocalLoginDialogOpen(true)}
            variant="outline"
            className='flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all animate-scale-in'
          >
            <User className='w-4 h-4' />
            <span className='truncate'>Log in</span>
          </Button>
          {/* Hide signup button on mobile - accessible via login dialog */}
          <Button
            onClick={() => setSignupDialogOpen(true)}
            variant="outline"
            className='hidden sm:flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all animate-scale-in border-primary text-primary hover:bg-primary/10'
          >
            <UserPlus className='w-4 h-4' />
            <span className='truncate'>Join Waitlist</span>
          </Button>
        </>
      )}

      <LoginDialog
        isOpen={loginDialogOpen}
        onClose={handleCloseLoginDialog}
        onLogin={handleLogin}
        onSignup={() => setSignupDialogOpen(true)}
      />

      <SignupDialog
        isOpen={signupDialogOpen}
        onClose={() => setSignupDialogOpen(false)}
        onComplete={handleLogin}
        onLogin={() => {
          setSignupDialogOpen(false);
          setLocalLoginDialogOpen(true);
        }}
      />

    </div>
  );
}