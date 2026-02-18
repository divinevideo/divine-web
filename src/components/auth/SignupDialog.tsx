import React from 'react';
import { Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { HubSpotSignup } from '@/components/HubSpotSignup';

interface SignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onLogin?: () => void;
}

const SignupDialog: React.FC<SignupDialogProps> = ({ isOpen, onClose, onLogin }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn("max-w-[95vw] sm:max-w-md max-h-[90vh] max-h-[90dvh] p-0 overflow-hidden rounded-2xl flex flex-col")}
      >
        <DialogHeader className={cn('px-6 pt-6 pb-1 relative flex-shrink-0')}>
          <DialogTitle className={cn('font-semibold text-center text-lg')}>
            Join the Waitlist
          </DialogTitle>
          <DialogDescription className={cn('text-muted-foreground text-center')}>
            {' '}
          </DialogDescription>
        </DialogHeader>
        <div className='px-6 pt-2 pb-6 space-y-6'>
          <div className='text-center space-y-6'>
            <div className='w-24 h-24 mx-auto bg-brand-light-green dark:bg-brand-dark-green rounded-full flex items-center justify-center'>
              <Mail className='w-12 h-12 text-primary' />
            </div>

            <div className='space-y-2'>
              <h3 className='text-xl font-semibold'>Get Early Access</h3>
              <p className='text-muted-foreground text-sm'>
                The Divine beta is currently full. If you'd like to hear our news and be amongst the first to hear when the diVine app goes live, sign up here.
              </p>
            </div>

            <div className='hs-form-dialog'>
              <HubSpotSignup />
            </div>

            {onLogin && (
              <p className='text-sm text-muted-foreground'>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    onClose();
                    onLogin();
                  }}
                  className='text-primary hover:underline font-medium'
                >
                  Log in
                </button>
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignupDialog;
