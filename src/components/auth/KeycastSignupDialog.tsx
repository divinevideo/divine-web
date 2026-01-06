// ABOUTME: Registration dialog for new Keycast users (custodial Nostr identity)
// ABOUTME: Guides users through email signup and profile creation

import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Lock,
  User,
  Upload,
  Sparkles,
  Globe,
  UserPlus,
  FileSignature,
  Cloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/useToast';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQueryClient } from '@tanstack/react-query';
import { debugLog } from '@/lib/debug';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useKeycastSession } from '@/hooks/useKeycastSession';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { registerUser } from '@/lib/keycast';

interface KeycastSignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onSwitchToLogin?: () => void;
}

export function KeycastSignupDialog({
  isOpen,
  onClose,
  onComplete,
  onSwitchToLogin,
}: KeycastSignupDialogProps) {
  const [step, setStep] = useState<
    'welcome' | 'register' | 'profile' | 'done'
  >('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    name: '',
    about: '',
    picture: '',
  });

  const login = useLoginActions();
  const { saveSession } = useKeycastSession();
  const currentUser = useCurrentUser();
  const { mutateAsync: publishEvent, isPending: isPublishing } =
    useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const queryClient = useQueryClient();
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('welcome');
      setIsLoading(false);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setRememberMe(false);
      setError(null);
      setProfileData({ name: '', about: '', picture: '' });
    }
  }, [isOpen]);

  const handleRegister = async () => {
    console.log('🚀 handleRegister CALLED');
    setError(null);

    // Validation
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Register with Keycast
      console.log('Step 1: Registering with Keycast...');
      const { token, pubkey } = await registerUser(email, password);
      console.log('Registration successful, pubkey:', pubkey);

      // Step 2: Save session
      console.log('Step 2: Saving session...');
      saveSession(token, email, pubkey, rememberMe);

      // Step 3: Create Keycast login (REST RPC based signing)
      console.log('Step 3: Creating Keycast login...');
      login.keycast(pubkey, token);
      console.log('✅ Keycast login created successfully');

      console.log('✅ Registration complete! Proceeding to profile setup...');

      toast({
        title: 'Account Created!',
        description: 'Your Keycast account has been created successfully.',
      });

      // Move to profile setup
      setStep('profile');
    } catch (err) {
      console.error('Keycast registration failed:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });

      let errorMessage = 'Registration failed. Please try again.';

      if (err instanceof Error) {
        // Provide more specific error messages
        if (err.message.includes('abort')) {
          errorMessage = 'Connection to identity server timed out. Please try again.';
        } else if (err.message.includes('fetch')) {
          errorMessage = 'Could not connect to identity server. Please check your internet connection.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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
      const url = tags[0]?.[1];
      if (url) {
        setProfileData((prev) => ({ ...prev, picture: url }));
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
    // Mark signup completion time
    localStorage.setItem('signup_completed', Date.now().toString());

    try {
      // Always publish a profile to tag the user as divine client
      const metadata: Record<string, string> = {
        client: 'divine.video', // Tag for follow list safety checks
      };

      // Add user-provided information if any
      if (
        !skipProfile &&
        (profileData.name || profileData.about || profileData.picture)
      ) {
        if (profileData.name) metadata.name = profileData.name;
        if (profileData.about) metadata.about = profileData.about;
        if (profileData.picture) metadata.picture = profileData.picture;
      }

      const profileEvent = await publishEvent({
        kind: 0,
        content: JSON.stringify(metadata),
      });

      debugLog('[KeycastSignupDialog] Profile published:', profileEvent);
      debugLog('[KeycastSignupDialog] Profile metadata:', metadata);

      // Invalidate safety check cache so new profile is recognized immediately
      // Wait a bit for the event to propagate through relays
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ['follow-list-safety-check'],
        });
        debugLog('[KeycastSignupDialog] Invalidated safety check cache after profile publication');
      }, 1000);

      if (
        !skipProfile &&
        (profileData.name || profileData.about || profileData.picture)
      ) {
        toast({
          title: 'Profile Created!',
          description: 'Your profile has been set up.',
        });
      }

      // Close signup and trigger completion
      onClose();
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 600);
      }
    } catch {
      toast({
        title: 'Profile Setup Failed',
        description:
          'Your account was created but profile setup failed. You can update it later.',
        variant: 'destructive',
      });

      // Still proceed to completion
      onClose();
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 600);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] max-h-[90dvh] p-0 overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-1 relative flex-shrink-0">
          <DialogTitle className="font-semibold text-center text-lg">
            {step === 'welcome' && (
              <span className="flex items-center justify-center gap-2">
                <Cloud className="w-5 h-5 text-primary" />
                Sign Up
              </span>
            )}
            {step === 'register' && (
              <span className="flex items-center justify-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Create Account
              </span>
            )}
            {step === 'profile' && (
              <span className="flex items-center justify-center gap-2">
                <FileSignature className="w-5 h-5 text-primary" />
                Set Up Profile
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-center">
            {step === 'welcome' && 'Sign up with email'}
            {step === 'register' && 'Choose your email and password'}
            {step === 'profile' && 'Optional - you can skip this'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-2 pb-4 space-y-4 overflow-y-scroll flex-1">
          {/* Welcome Step */}
          {step === 'welcome' && (
            <div className="text-center space-y-4">
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50">
                <div className="flex justify-center items-center space-x-4 mb-3">
                  <div className="relative">
                    <Cloud className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                    <Sparkles className="w-4 h-4 text-yellow-500 dark:text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <Globe className="w-16 h-16 text-blue-700 dark:text-blue-400 animate-spin-slow" />
                  <div className="relative">
                    <Mail className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                    <Sparkles
                      className="w-4 h-4 text-yellow-500 dark:text-yellow-400 absolute -top-1 -left-1 animate-pulse"
                      style={{ animationDelay: '0.3s' }}
                    />
                  </div>
                </div>

                <p className="text-muted-foreground">
                  Create an account with just your email and password.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                    Beta Access Limited
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    The current beta is only open to existing Nostr users. New account creation is temporarily disabled.
                  </p>
                </div>

                <Button
                  className="w-full rounded-full py-6 text-lg font-semibold bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed opacity-60"
                  disabled
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Sign Up Disabled
                </Button>

                <p className="text-xs text-muted-foreground">
                  Have a Nostr account?{' '}
                  <button
                    onClick={() => {
                      onClose();
                      if (onSwitchToLogin) {
                        onSwitchToLogin();
                      }
                    }}
                    className="underline hover:text-primary"
                  >
                    Log in
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* Register Step */}
          {step === 'register' && (
            <div className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="signup-email" className="text-sm font-medium">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    className="pl-10 rounded-lg"
                    placeholder="your@email.com"
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="signup-password"
                  className="text-sm font-medium"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    className="pl-10 rounded-lg"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="signup-confirm-password"
                  className="text-sm font-medium"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    className="pl-10 rounded-lg"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="signup-remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) =>
                    setRememberMe(checked === true)
                  }
                  disabled={isLoading}
                />
                <label
                  htmlFor="signup-remember-me"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Remember me for 1 week
                </label>
              </div>

              <Button
                className="w-full rounded-full py-4 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform transition-all duration-200 hover:scale-105 shadow-lg"
                onClick={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Powered by Keycast
              </p>
            </div>
          )}

          {/* Profile Step */}
          {step === 'profile' && (
            <div className="text-center space-y-4">
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                  <Sparkles
                    className="absolute top-3 left-4 w-3 h-3 text-yellow-400 animate-pulse"
                    style={{ animationDelay: '0s' }}
                  />
                  <Sparkles
                    className="absolute top-6 right-6 w-3 h-3 text-yellow-500 animate-pulse"
                    style={{ animationDelay: '0.5s' }}
                  />
                  <Sparkles
                    className="absolute bottom-4 left-6 w-3 h-3 text-yellow-400 animate-pulse"
                    style={{ animationDelay: '1s' }}
                  />
                </div>

                <div className="relative z-10 flex justify-center items-center mb-3">
                  <div className="relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-200 to-indigo-300 rounded-full flex items-center justify-center shadow-lg">
                      <User className="w-8 h-8 text-blue-800" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center animate-bounce">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>

                <div className="relative z-10 space-y-2">
                  <p className="text-base font-semibold">
                    Almost there! Let's set up your profile
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your profile is your identity on Nostr.
                  </p>
                </div>
              </div>

              {isPublishing && (
                <div className="relative p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Publishing your profile...
                    </span>
                  </div>
                </div>
              )}

              <div
                className={`space-y-4 text-left ${
                  isPublishing ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <div className="space-y-2">
                  <label
                    htmlFor="profile-name"
                    className="text-sm font-medium"
                  >
                    Display Name
                  </label>
                  <Input
                    id="profile-name"
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Your name"
                    className="rounded-lg"
                    disabled={isPublishing}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="profile-about"
                    className="text-sm font-medium"
                  >
                    Bio
                  </label>
                  <Textarea
                    id="profile-about"
                    value={profileData.about}
                    onChange={(e) =>
                      setProfileData((prev) => ({
                        ...prev,
                        about: e.target.value,
                      }))
                    }
                    placeholder="Tell others about yourself..."
                    className="rounded-lg resize-none"
                    rows={3}
                    disabled={isPublishing}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="profile-picture"
                    className="text-sm font-medium"
                  >
                    Avatar
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="profile-picture"
                      value={profileData.picture}
                      onChange={(e) =>
                        setProfileData((prev) => ({
                          ...prev,
                          picture: e.target.value,
                        }))
                      }
                      placeholder="https://example.com/your-avatar.jpg"
                      className="rounded-lg flex-1"
                      disabled={isPublishing}
                    />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={avatarFileInputRef}
                      onChange={handleAvatarUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => avatarFileInputRef.current?.click()}
                      disabled={isUploading || isPublishing}
                      className="rounded-lg shrink-0"
                      title="Upload avatar image"
                    >
                      {isUploading ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {!currentUser.user && (
                  <div className="text-center text-sm text-muted-foreground mb-2">
                    Connecting to your account...
                  </div>
                )}
                <Button
                  className="w-full rounded-full py-4 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  onClick={() => finishSignup(false)}
                  disabled={isPublishing || isUploading || !currentUser.user}
                >
                  {isPublishing ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Creating Profile...
                    </>
                  ) : !currentUser.user ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 mr-2" />
                      Create Profile & Finish
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  className="w-full rounded-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => finishSignup(true)}
                  disabled={isPublishing || isUploading || !currentUser.user}
                >
                  {isPublishing ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Setting up account...
                    </>
                  ) : (
                    'Skip for now'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
