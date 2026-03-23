import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Cloud, KeyRound, Shield, Upload } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { setInviteHandoff } from '@/lib/authHandoff';
import { buildSignupRedirect } from '@/lib/divineLogin';
import { getInviteClientConfig, joinInviteWaitlist, validateInviteCode } from '@/lib/inviteApi';
import { getStoredLocalNsecLogin } from '@/lib/localNsecAccount';
import { cn } from '@/lib/utils';
import { useLoginActions } from '@/hooks/useLoginActions';

import InviteCodeForm from './InviteCodeForm';
import LocalNsecBanner from './LocalNsecBanner';
import WaitlistForm from './WaitlistForm';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

type DialogView = 'invite' | 'waitlist';

const validateNsec = (nsec: string) => /^nsec1[a-zA-Z0-9]{58}$/.test(nsec);
const validateBunkerUri = (uri: string) => uri.startsWith('bunker://');

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLogin }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bunkerError, setBunkerError] = useState<string | null>(null);
  const [bunkerUri, setBunkerUri] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [nsec, setNsec] = useState('');
  const [storedLocalNsec, setStoredLocalNsec] = useState<string | null>(null);
  const [view, setView] = useState<DialogView>('invite');
  const [waitlistContact, setWaitlistContact] = useState('');
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const login = useLoginActions();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAdvancedOpen(false);
    setBunkerError(null);
    setBunkerUri('');
    setConfigError(null);
    setInviteCode('');
    setInviteError(null);
    setIsConfigLoading(true);
    setIsFileLoading(false);
    setIsInviteLoading(false);
    setIsLoginLoading(false);
    setIsWaitlistLoading(false);
    setKeyError(null);
    setNsec('');
    setStoredLocalNsec(getStoredLocalNsecLogin()?.data.nsec ?? null);
    setView('invite');
    setWaitlistContact('');
    setWaitlistEnabled(false);
    setWaitlistError(null);
    setWaitlistSuccess(false);

    let isCancelled = false;

    getInviteClientConfig()
      .then((config) => {
        if (!isCancelled) {
          setWaitlistEnabled(config.waitlistEnabled);
        }
      })
      .catch((caughtError) => {
        if (!isCancelled) {
          setConfigError(caughtError instanceof Error ? caughtError.message : 'Invite service unavailable');
          setAdvancedOpen(true);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsConfigLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  const handleExtensionLogin = async () => {
    setIsLoginLoading(true);
    setConfigError(null);

    try {
      if (!('nostr' in window)) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.');
      }

      await login.extension();
      onLogin();
      onClose();
    } catch (caughtError) {
      setConfigError(caughtError instanceof Error ? caughtError.message : 'Extension login failed');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const executeNsecLogin = (nextNsec: string) => {
    setIsLoginLoading(true);
    setKeyError(null);

    window.setTimeout(() => {
      try {
        login.nsec(nextNsec);
        onLogin();
        onClose();
      } catch {
        setKeyError('Failed to login with this key. Please check that it is correct.');
        setIsLoginLoading(false);
      }
    }, 50);
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) {
      setKeyError('Please enter your secret key');
      return;
    }

    if (!validateNsec(nsec)) {
      setKeyError('Invalid secret key format. Must be a valid nsec starting with nsec1.');
      return;
    }

    executeNsecLogin(nsec);
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setBunkerError('Please enter a bunker URI');
      return;
    }

    if (!validateBunkerUri(bunkerUri)) {
      setBunkerError('Invalid bunker URI format. Must start with bunker://');
      return;
    }

    setIsLoginLoading(true);
    setBunkerError(null);

    try {
      await login.bunker(bunkerUri);
      onLogin();
      onClose();
      setBunkerUri('');
    } catch {
      setBunkerError('Failed to connect to bunker. Please check the URI.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsFileLoading(true);
    setKeyError(null);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setIsFileLoading(false);
      const content = typeof loadEvent.target?.result === 'string'
        ? loadEvent.target.result.trim()
        : '';

      if (!content) {
        setKeyError('Could not read file content.');
        return;
      }

      if (!validateNsec(content)) {
        setKeyError('File does not contain a valid secret key.');
        return;
      }

      executeNsecLogin(content);
    };
    reader.onerror = () => {
      setIsFileLoading(false);
      setKeyError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteError(null);
    setIsInviteLoading(true);

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
      setInviteError(caughtError instanceof Error ? caughtError.message : 'Unable to validate invite code');
    } finally {
      setIsInviteLoading(false);
    }
  };

  const handleWaitlistSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWaitlistError(null);
    setIsWaitlistLoading(true);

    try {
      await joinInviteWaitlist(waitlistContact);
      setWaitlistSuccess(true);
    } catch (caughtError) {
      setWaitlistError(caughtError instanceof Error ? caughtError.message : 'Unable to join the waitlist');
    } finally {
      setIsWaitlistLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('max-w-[95vw] overflow-hidden rounded-2xl p-0 sm:max-w-md')}>
        <DialogHeader className="space-y-2 px-6 pb-1 pt-6">
          <DialogTitle className="sr-only">Sign in to Divine</DialogTitle>
          <DialogDescription className="text-center text-base font-medium text-foreground">
            Create or sign in to your account
          </DialogDescription>
          <p className="text-center text-sm text-muted-foreground">
            Use an invite to continue with the main web login flow. Advanced Nostr signers are still available.
          </p>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-6 pt-2">
          {storedLocalNsec ? <LocalNsecBanner nsec={storedLocalNsec} /> : null}

          {configError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{configError}</AlertDescription>
            </Alert>
          ) : null}

          {isConfigLoading ? (
            <div className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              Checking invite status...
            </div>
          ) : view === 'invite' ? (
            <InviteCodeForm
              error={inviteError}
              isLoading={isInviteLoading}
              onInviteCodeChange={setInviteCode}
              onJoinWaitlist={() => setView('waitlist')}
              onSubmit={handleInviteSubmit}
              value={inviteCode}
              waitlistEnabled={waitlistEnabled}
            />
          ) : (
            <WaitlistForm
              contact={waitlistContact}
              error={waitlistError}
              isLoading={isWaitlistLoading}
              isSuccess={waitlistSuccess}
              onBack={() => setView('invite')}
              onContactChange={setWaitlistContact}
              onSubmit={handleWaitlistSubmit}
            />
          )}

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button className="w-full rounded-full" type="button" variant="outline">
                Advanced login methods
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <Tabs className="w-full" defaultValue="extension">
                <TabsList className="grid w-full grid-cols-3 rounded-lg bg-muted">
                  <TabsTrigger className="flex items-center gap-2" value="extension">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Extension</span>
                    <span className="sm:hidden">Ext</span>
                  </TabsTrigger>
                  <TabsTrigger className="flex items-center gap-2" value="key">
                    <KeyRound className="h-4 w-4" />
                    <span>Key</span>
                  </TabsTrigger>
                  <TabsTrigger className="flex items-center gap-2" value="bunker">
                    <Cloud className="h-4 w-4" />
                    <span className="hidden sm:inline">Bunker</span>
                    <span className="sm:hidden">Bnkr</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent className="space-y-3 pt-4" value="extension">
                  <div className="space-y-3 rounded-2xl bg-muted p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Use your browser extension if you already have a signer set up.
                    </p>
                    <Button className="w-full rounded-full py-4" disabled={isLoginLoading} onClick={handleExtensionLogin}>
                      {isLoginLoading ? 'Logging in...' : 'Login with Extension'}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent className="space-y-4 pt-4" value="key">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="nsec">
                      Secret key (nsec)
                    </label>
                    <Input
                      autoComplete="off"
                      id="nsec"
                      onChange={(event) => {
                        setNsec(event.target.value);
                        setKeyError(null);
                      }}
                      placeholder="nsec1..."
                      type="password"
                      value={nsec}
                    />
                    {keyError ? <p className="text-sm text-red-500">{keyError}</p> : null}
                  </div>

                  <Button className="w-full rounded-full py-3" disabled={isLoginLoading || !nsec.trim()} onClick={handleKeyLogin}>
                    {isLoginLoading ? 'Verifying...' : 'Log In'}
                  </Button>

                  <input
                    accept=".txt"
                    className="hidden"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    type="file"
                  />
                  <Button
                    className="w-full"
                    disabled={isLoginLoading || isFileLoading}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isFileLoading ? 'Reading File...' : 'Upload Your Key File'}
                  </Button>
                </TabsContent>

                <TabsContent className="space-y-4 pt-4" value="bunker">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="bunkerUri">
                      Bunker URI
                    </label>
                    <Input
                      autoComplete="off"
                      id="bunkerUri"
                      onChange={(event) => {
                        setBunkerUri(event.target.value);
                        setBunkerError(null);
                      }}
                      placeholder="bunker://"
                      value={bunkerUri}
                    />
                    {bunkerError ? <p className="text-sm text-red-500">{bunkerError}</p> : null}
                  </div>

                  <Button
                    className="w-full rounded-full py-4"
                    disabled={isLoginLoading || !bunkerUri.trim()}
                    onClick={handleBunkerLogin}
                  >
                    {isLoginLoading ? 'Connecting...' : 'Login with Bunker'}
                  </Button>
                </TabsContent>
              </Tabs>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
