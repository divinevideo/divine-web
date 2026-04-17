// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { useState, useEffect } from 'react';
import { User } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button.tsx';
import LoginDialog from './LoginDialog';
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

  // Open invite-first auth dialog via legacy #signup deep link handling in main.tsx
  useEffect(() => {
    if (sessionStorage.getItem('openInviteAuth') || sessionStorage.getItem('openSignup')) {
      sessionStorage.removeItem('openInviteAuth');
      sessionStorage.removeItem('openSignup');
      setLocalLoginDialogOpen(true);
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
  };

  return (
    <div className={cn("inline-flex items-center justify-center gap-2", className)}>
      {currentUser ? (
        <AccountSwitcher onAddAccountClick={() => setLocalLoginDialogOpen(true)} />
      ) : (
        <Button
          onClick={() => setLocalLoginDialogOpen(true)}
          variant="sticker"
          className='flex items-center gap-2 px-4 py-2 font-medium transition-all animate-scale-in'
        >
          <User className='w-4 h-4' />
          <span className='truncate'>Log in</span>
        </Button>
      )}

      <LoginDialog
        isOpen={loginDialogOpen}
        onClose={handleCloseLoginDialog}
        onLogin={handleLogin}
      />
    </div>
  );
}
