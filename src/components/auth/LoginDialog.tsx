import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Warning as AlertTriangle, Cloud, Key as KeyRound, Shield, UploadSimple as Upload } from '@phosphor-icons/react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { setInviteHandoff } from '@/lib/authHandoff';
import { buildLoginRedirect, buildSignupRedirect } from '@/lib/divineLogin';
import { getInviteClientConfig, joinInviteWaitlist, validateInviteCode } from '@/lib/inviteApi';
import { getStoredLocalNsecLogin } from '@/lib/localNsecAccount';
import { cn } from '@/lib/utils';
import { useLoginActions } from '@/hooks/useLoginActions';

import InviteCodeForm from './InviteCodeForm';
import LocalNsecBanner from './LocalNsecBanner';
import WaitlistForm from './WaitlistForm';
import WebAccountSignInForm from './WebAccountSignInForm';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

type AuthTab = 'register' | 'signin';
type RegisterView = 'invite' | 'waitlist';

const validateNsec = (nsec: string) => /^nsec1[a-zA-Z0-9]{58}$/.test(nsec);
const validateBunkerUri = (uri: string) => uri.startsWith('bunker://');

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLogin }) => {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bunkerError, setBunkerError] = useState<string | null>(null);
  const [bunkerUri, setBunkerUri] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [inviteConfigError, setInviteConfigError] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<AuthTab>('register');
  const [registerView, setRegisterView] = useState<RegisterView>('invite');
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
    setGeneralError(null);
    setInviteConfigError(null);
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
    setActiveTab('register');
    setRegisterView('invite');
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
          setInviteConfigError(caughtError instanceof Error ? caughtError.message : t('loginDialog.errorInviteServiceUnavailable'));
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
    setGeneralError(null);

    try {
      if (!('nostr' in window)) {
        throw new Error(t('loginDialog.errorExtensionNotFound'));
      }

      await login.extension();
      onLogin();
      onClose();
    } catch (caughtError) {
      setGeneralError(caughtError instanceof Error ? caughtError.message : t('loginDialog.errorExtensionLoginFailed'));
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
        setKeyError(t('loginDialog.errorKeyLoginFailed'));
        setIsLoginLoading(false);
      }
    }, 50);
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) {
      setKeyError(t('loginDialog.errorNsecRequired'));
      return;
    }

    if (!validateNsec(nsec)) {
      setKeyError(t('loginDialog.errorNsecInvalid'));
      return;
    }

    executeNsecLogin(nsec);
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setBunkerError(t('loginDialog.errorBunkerRequired'));
      return;
    }

    if (!validateBunkerUri(bunkerUri)) {
      setBunkerError(t('loginDialog.errorBunkerInvalid'));
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
      setBunkerError(t('loginDialog.errorBunkerConnectFailed'));
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
        setKeyError(t('loginDialog.errorFileEmpty'));
        return;
      }

      if (!validateNsec(content)) {
        setKeyError(t('loginDialog.errorFileNoValidKey'));
        return;
      }

      executeNsecLogin(content);
    };
    reader.onerror = () => {
      setIsFileLoading(false);
      setKeyError(t('loginDialog.errorFileReadFailed'));
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
      setInviteError(caughtError instanceof Error ? caughtError.message : t('loginDialog.errorInviteValidationFailed'));
    } finally {
      setIsInviteLoading(false);
    }
  };

  const handleExistingAccountLogin = async () => {
    setGeneralError(null);
    setIsLoginLoading(true);

    try {
      const returnPath = `${window.location.pathname}${window.location.search}`;
      const redirect = await buildLoginRedirect({ returnPath });
      window.location.assign(redirect.url);
    } catch (caughtError) {
      setGeneralError(caughtError instanceof Error ? caughtError.message : t('loginDialog.errorSignInStartFailed'));
      setIsLoginLoading(false);
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
      setWaitlistError(caughtError instanceof Error ? caughtError.message : t('loginDialog.errorWaitlistJoinFailed'));
    } finally {
      setIsWaitlistLoading(false);
    }
  };

  const handleAuthTabChange = (value: string) => {
    const nextTab = value === 'signin' ? 'signin' : 'register';
    setActiveTab(nextTab);
    setGeneralError(null);

    if (nextTab !== 'signin') {
      setAdvancedOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('max-w-[95vw] overflow-hidden rounded-2xl p-0 sm:max-w-md')}>
        <DialogHeader className="space-y-2 px-6 pb-1 pt-6">
          <DialogTitle className="sr-only">{t('loginDialog.title')}</DialogTitle>
          <DialogDescription className="text-center text-base font-medium text-foreground">
            {t('loginDialog.heading')}
          </DialogDescription>
          <p className="text-center text-sm text-muted-foreground">
            {activeTab === 'register'
              ? t('loginDialog.subtitleRegister')
              : t('loginDialog.subtitleSignIn')}
          </p>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-6 pt-2">
          {storedLocalNsec ? <LocalNsecBanner nsec={storedLocalNsec} /> : null}

          {generalError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          ) : null}

          <Tabs className="space-y-4" onValueChange={handleAuthTabChange} value={activeTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="register">{t('loginDialog.tabRegister')}</TabsTrigger>
              <TabsTrigger value="signin">{t('loginDialog.tabSignIn')}</TabsTrigger>
            </TabsList>

            <TabsContent className="space-y-4" value="register">
              {isConfigLoading ? (
                <div className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('loginDialog.checkingInvite')}
                </div>
              ) : inviteConfigError ? (
                <div className="space-y-2 rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                  <p>{t('loginDialog.inviteUnavailable')}</p>
                  <p className="text-red-500">{inviteConfigError}</p>
                </div>
              ) : registerView === 'invite' ? (
                <InviteCodeForm
                  error={inviteError}
                  isLoading={isInviteLoading}
                  onInviteCodeChange={setInviteCode}
                  onJoinWaitlist={() => setRegisterView('waitlist')}
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
                  onBack={() => setRegisterView('invite')}
                  onContactChange={setWaitlistContact}
                  onSubmit={handleWaitlistSubmit}
                />
              )}
            </TabsContent>

            <TabsContent className="space-y-4" value="signin">
              <WebAccountSignInForm
                advancedOpen={advancedOpen}
                isLoading={isLoginLoading}
                onContinue={handleExistingAccountLogin}
                onToggleAdvanced={() => setAdvancedOpen((current) => !current)}
              />

              <Collapsible open={advancedOpen}>
                <CollapsibleContent className="space-y-4 pt-2">
                  <Tabs className="w-full" defaultValue="extension">
                    <TabsList className="grid w-full grid-cols-3 rounded-lg bg-muted">
                      <TabsTrigger className="flex items-center gap-2" value="extension">
                        <Shield className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('loginDialog.tabExtension')}</span>
                        <span className="sm:hidden">{t('loginDialog.tabExtensionShort')}</span>
                      </TabsTrigger>
                      <TabsTrigger className="flex items-center gap-2" value="key">
                        <KeyRound className="h-4 w-4" />
                        <span>{t('loginDialog.tabKey')}</span>
                      </TabsTrigger>
                      <TabsTrigger className="flex items-center gap-2" value="bunker">
                        <Cloud className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('loginDialog.tabBunker')}</span>
                        <span className="sm:hidden">{t('loginDialog.tabBunkerShort')}</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent className="space-y-3 pt-4" value="extension">
                      <div className="space-y-3 rounded-2xl bg-muted p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          {t('loginDialog.extensionHelper')}
                        </p>
                        <Button className="w-full rounded-full py-4" disabled={isLoginLoading} onClick={handleExtensionLogin}>
                          {isLoginLoading ? t('loginDialog.loggingIn') : t('loginDialog.extensionButton')}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent className="space-y-4 pt-4" value="key">
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="nsec">
                          {t('loginDialog.nsecLabel')}
                        </label>
                        <Input
                          autoComplete="off"
                          id="nsec"
                          onChange={(event) => {
                            setNsec(event.target.value);
                            setKeyError(null);
                          }}
                          placeholder={t('loginDialog.nsecPlaceholder')}
                          type="password"
                          value={nsec}
                        />
                        {keyError ? <p className="text-sm text-red-500">{keyError}</p> : null}
                      </div>

                      <Button className="w-full rounded-full py-3" disabled={isLoginLoading || !nsec.trim()} onClick={handleKeyLogin}>
                        {isLoginLoading ? t('loginDialog.verifying') : t('loginDialog.keyLoginButton')}
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
                        {isFileLoading ? t('loginDialog.readingFile') : t('loginDialog.uploadKeyFile')}
                      </Button>
                    </TabsContent>

                    <TabsContent className="space-y-4 pt-4" value="bunker">
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="bunkerUri">
                          {t('loginDialog.bunkerLabel')}
                        </label>
                        <Input
                          autoComplete="off"
                          id="bunkerUri"
                          onChange={(event) => {
                            setBunkerUri(event.target.value);
                            setBunkerError(null);
                          }}
                          placeholder={t('loginDialog.bunkerPlaceholder')}
                          value={bunkerUri}
                        />
                        {bunkerError ? <p className="text-sm text-red-500">{bunkerError}</p> : null}
                      </div>

                      <Button
                        className="w-full rounded-full py-4"
                        disabled={isLoginLoading || !bunkerUri.trim()}
                        onClick={handleBunkerLogin}
                      >
                        {isLoginLoading ? t('loginDialog.connecting') : t('loginDialog.bunkerButton')}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
