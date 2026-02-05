// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useState, useEffect, useRef } from 'react';
import { Download, Key, Lock, CheckCircle, Copy, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from '@/hooks/useToast';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useQueryClient } from '@tanstack/react-query';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { cn } from '@/lib/utils';
import { debugLog } from '@/lib/debug';

interface SignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onLogin?: () => void;
}

const sanitizeFilename = (filename: string) => {
  return filename.replace(/[^a-z0-9_.-]/gi, '_');
}

const SignupDialog: React.FC<SignupDialogProps> = ({ isOpen, onClose, onComplete, onLogin }) => {
  const [step, setStep] = useState<'welcome' | 'generate' | 'download' | 'profile' | 'done'>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [showSparkles, setShowSparkles] = useState(false);
  const [keySecured, setKeySecured] = useState<'none' | 'copied' | 'downloaded'>('none');
  const [profileData, setProfileData] = useState({
    name: '',
    about: '',
    picture: ''
  });
  const login = useLoginActions();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const queryClient = useQueryClient();
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Generate a proper nsec key using nostr-tools
  const generateKey = () => {
    setIsLoading(true);
    setShowSparkles(true);

    // Add a dramatic pause for the key generation effect
    setTimeout(() => {
      try {
        // Generate a new secret key
        const sk = generateSecretKey();

        // Convert to nsec format
        setNsec(nip19.nsecEncode(sk));
        setStep('download');

        toast({
          title: 'Your Secret Key is Ready!',
          description: 'A new secret key has been generated for you.',
        });
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to generate key. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
        setShowSparkles(false);
      }
    }, 2000);
  };

  const downloadKey = () => {
    try {
      // Create a blob with the key text
      const blob = new Blob([nsec], { type: 'text/plain; charset=utf-8' });
      const url = globalThis.URL.createObjectURL(blob);

      // Sanitize filename
      const filename = sanitizeFilename('secret-key.txt');

      // Create a temporary link element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Clean up immediately
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Mark as secured
      setKeySecured('downloaded');

      toast({
        title: 'Secret Key Saved!',
        description: 'Your key has been safely stored.',
      });
    } catch {
      toast({
        title: 'Download failed',
        description: 'Could not download the key file. Please copy it manually.',
        variant: 'destructive',
      });
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(nsec);
    setKeySecured('copied');
    toast({
      title: 'Copied to clipboard!',
      description: 'Key copied to clipboard.',
    });
  };

  const finishKeySetup = () => {
    try {
      login.nsec(nsec);
      setStep('profile');
    } catch {
      toast({
        title: 'Login Failed',
        description: 'Failed to login with the generated key. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    e.target.value = '';

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file for your avatar.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Avatar image must be smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const tags = await uploadFile(file);
      // Get the URL from the first tag
      const url = tags[0]?.[1];
      if (url) {
        setProfileData(prev => ({ ...prev, picture: url }));
        toast({
          title: 'Avatar uploaded!',
          description: 'Your avatar has been uploaded successfully.',
        });
      }
    } catch {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload avatar. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const finishSignup = async (skipProfile = false) => {
    // Mark signup completion time for fallback welcome modal
    localStorage.setItem('signup_completed', Date.now().toString());

    try {
      // Always publish a profile to tag the user as divine client
      const metadata: Record<string, string> = {
        client: 'divine.video', // Tag for follow list safety checks
      };

      // Add user-provided information if any
      if (!skipProfile && (profileData.name || profileData.about || profileData.picture)) {
        if (profileData.name) metadata.name = profileData.name;
        if (profileData.about) metadata.about = profileData.about;
        if (profileData.picture) metadata.picture = profileData.picture;
      }

      const profileEvent = await publishEvent({
        kind: 0,
        content: JSON.stringify(metadata),
      });

      debugLog('[SignupDialog] Profile published:', profileEvent);
      debugLog('[SignupDialog] Profile metadata:', metadata);

      // Invalidate safety check cache so new profile is recognized immediately
      // Wait a bit for the event to propagate through relays
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ['follow-list-safety-check'],
        });
        debugLog('[SignupDialog] Invalidated safety check cache after profile publication');
      }, 1000);

      if (!skipProfile && (profileData.name || profileData.about || profileData.picture)) {
        toast({
          title: 'Profile Created!',
          description: 'Your profile has been set up.',
        });
      }

      // Close signup and show welcome modal
      onClose();
      if (onComplete) {
        // Add a longer delay to ensure login state has fully propagated
        setTimeout(() => {
          onComplete();
        }, 600);
      } else {
        // Fallback for when used without onComplete
        setStep('done');
        setTimeout(() => {
          onClose();
          toast({
            title: 'Welcome!',
            description: 'Your account is ready.',
          });
        }, 3000);
      }
    } catch {
      toast({
        title: 'Profile Setup Failed',
        description: 'Your account was created but profile setup failed. You can update it later.',
        variant: 'destructive',
      });

      // Still proceed to completion even if profile failed
      onClose();
      if (onComplete) {
        // Add a longer delay to ensure login state has fully propagated
        setTimeout(() => {
          onComplete();
        }, 600);
      } else {
        // Fallback for when used without onComplete
        setStep('done');
        setTimeout(() => {
          onClose();
          toast({
            title: 'Welcome!',
            description: 'Your account is ready.',
          });
        }, 3000);
      }
    }
  };

  const getTitle = () => {
    if (step === 'welcome') return 'Sign Up';
    if (step === 'generate') return 'Sign Up';
    if (step === 'download') return 'Sign Up';
    if (step === 'profile') return 'Sign Up';
    return 'Welcome';
  };

  const getDescription = () => {
    return '';
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('welcome');
      setIsLoading(false);
      setNsec('');
      setShowSparkles(false);
      setKeySecured('none');
      setProfileData({ name: '', about: '', picture: '' });
    }
  }, [isOpen]);

  // Add sparkle animation effect
  useEffect(() => {
    if (showSparkles) {
      const interval = setInterval(() => {
        // This will trigger re-renders for sparkle animation
      }, 100);
      return () => clearInterval(interval);
    }
  }, [showSparkles]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn("max-w-[95vw] sm:max-w-md max-h-[90vh] max-h-[90dvh] p-0 overflow-hidden rounded-2xl flex flex-col")}
      >
        <DialogHeader className={cn('px-6 pt-6 pb-1 relative flex-shrink-0')}>
          <DialogTitle className={cn('font-semibold text-center text-lg')}>
            {getTitle()}
          </DialogTitle>
          <DialogDescription className={cn(`text-muted-foreground text-center ${step === 'download' && 'hidden'}`)}>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>
        <div className='px-6 pt-2 pb-4 space-y-4 overflow-y-scroll flex-1'>
          {/* Welcome Step */}
          {step === 'welcome' && (
            <div className='text-center space-y-6'>
              <div className='w-24 h-24 mx-auto bg-brand-light-green dark:bg-brand-dark-green rounded-full flex items-center justify-center'>
                <Key className='w-12 h-12 text-primary' />
              </div>

              <div className='space-y-2'>
                <h3 className='text-xl font-semibold'>Create Account</h3>
                <p className='text-muted-foreground'>
                  Generate a secret key to get started
                </p>
              </div>

              <Button
                className='w-full rounded-full py-6'
                onClick={() => setStep('generate')}
              >
                Continue
              </Button>

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
          )}

          {/* Generate Step */}
          {step === 'generate' && (
            <div className='text-center space-y-6'>
              {isLoading ? (
                <div className='space-y-4'>
                  <div className='w-24 h-24 mx-auto bg-brand-light-green dark:bg-brand-dark-green rounded-full flex items-center justify-center'>
                    <div className='w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin'></div>
                  </div>
                  <p className='text-muted-foreground'>Generating key...</p>
                </div>
              ) : (
                <>
                  <div className='w-24 h-24 mx-auto bg-brand-light-green dark:bg-brand-dark-green rounded-full flex items-center justify-center'>
                    <Key className='w-12 h-12 text-primary' />
                  </div>

                  <div className='space-y-2'>
                    <h3 className='text-xl font-semibold'>Generate Secret Key</h3>
                    <p className='text-muted-foreground'>
                      This key is your password for Nostr
                    </p>
                  </div>

                  <Button
                    className='w-full rounded-full py-6'
                    onClick={generateKey}
                    disabled={isLoading}
                  >
                    Generate Key
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Download Step */}
          {step === 'download' && (
            <div className='text-center space-y-6'>
              <div className='space-y-4'>
                <div className='w-24 h-24 mx-auto bg-brand-light-green dark:bg-brand-dark-green rounded-full flex items-center justify-center'>
                  <Lock className='w-12 h-12 text-primary' />
                </div>

                <div className='space-y-2'>
                  <h3 className='text-xl font-semibold'>Save Your Key</h3>
                  <p className='text-sm text-destructive font-medium'>
                    If you lose this key, you lose your account
                  </p>
                </div>
              </div>

              <div className='space-y-3'>
                <Button
                  variant={keySecured === 'downloaded' ? 'default' : 'outline'}
                  className='w-full justify-start'
                  onClick={downloadKey}
                >
                  <Download className='w-4 h-4 mr-2' />
                  Download Key
                  {keySecured === 'downloaded' && (
                    <CheckCircle className='w-4 h-4 ml-auto text-green-600 dark:text-green-400' />
                  )}
                </Button>

                <Button
                  variant={keySecured === 'copied' ? 'default' : 'outline'}
                  className='w-full justify-start'
                  onClick={copyKey}
                >
                  <Copy className='w-4 h-4 mr-2' />
                  Copy to Clipboard
                  {keySecured === 'copied' && (
                    <CheckCircle className='w-4 h-4 ml-auto text-green-600 dark:text-green-400' />
                  )}
                </Button>
              </div>

              <Button
                className='w-full rounded-full py-6'
                onClick={finishKeySetup}
                disabled={keySecured === 'none'}
              >
                {keySecured === 'none' ? 'Save your key to continue' : 'Continue'}
              </Button>
            </div>
          )}

          {/* Profile Step */}
          {step === 'profile' && (
            <div className='space-y-6'>
              <div className='text-center space-y-2'>
                <h3 className='text-xl font-semibold'>Set Up Profile</h3>
                <p className='text-sm text-muted-foreground'>Optional</p>
              </div>

              {isPublishing && (
                <div className='flex items-center justify-center gap-2 p-4 bg-muted rounded-lg'>
                  <div className='w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin' />
                  <span className='text-sm'>Publishing...</span>
                </div>
              )}

              <div className={`space-y-4 ${isPublishing ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className='space-y-2'>
                  <label htmlFor='profile-name' className='text-sm font-medium'>
                    Name
                  </label>
                  <Input
                    id='profile-name'
                    value={profileData.name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder='Your name'
                    disabled={isPublishing}
                  />
                </div>

                <div className='space-y-2'>
                  <label htmlFor='profile-about' className='text-sm font-medium'>
                    Bio
                  </label>
                  <Textarea
                    id='profile-about'
                    value={profileData.about}
                    onChange={(e) => setProfileData(prev => ({ ...prev, about: e.target.value }))}
                    placeholder='About you'
                    className='resize-none'
                    rows={3}
                    disabled={isPublishing}
                  />
                </div>

                <div className='space-y-2'>
                  <label htmlFor='profile-picture' className='text-sm font-medium'>
                    Avatar URL
                  </label>
                  <div className='flex gap-2'>
                    <Input
                      id='profile-picture'
                      value={profileData.picture}
                      onChange={(e) => setProfileData(prev => ({ ...prev, picture: e.target.value }))}
                      placeholder='https://...'
                      className='flex-1'
                      disabled={isPublishing}
                    />
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      ref={avatarFileInputRef}
                      onChange={handleAvatarUpload}
                    />
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      onClick={() => avatarFileInputRef.current?.click()}
                      disabled={isUploading || isPublishing}
                      title='Upload'
                    >
                      {isUploading ? (
                        <div className='w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin' />
                      ) : (
                        <Upload className='w-4 h-4' />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className='space-y-3'>
                <Button
                  className='w-full rounded-full py-6'
                  onClick={() => finishSignup(false)}
                  disabled={isPublishing || isUploading}
                >
                  {isPublishing ? 'Publishing...' : 'Create Profile'}
                </Button>

                <Button
                  variant='outline'
                  className='w-full'
                  onClick={() => finishSignup(true)}
                  disabled={isPublishing || isUploading}
                >
                  Skip
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignupDialog;
