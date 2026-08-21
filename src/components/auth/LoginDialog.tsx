import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Warning as AlertTriangle, Cloud, Key as KeyRound, Shield, UploadSimple as Upload } from '@phosphor-icons/react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getProductAnalyticsUtm, trackProductEvent } from '@/lib/analyticsClient';
import { buildLoginRedirect, buildSignupRedirect } from '@/lib/divineLogin';
import { getStoredLocalNsecLogin } from '@/lib/localNsecAccount';
import { isMinorKeyHandoverRestricted } from '@/lib/protectedMinor';
import { cn } from '@/lib/utils';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';

import LocalNsecBanner from './LocalNsecBanner';
import WebAccountSignInForm from './WebAccountSignInForm';

interface LoginDialogProps {
  initialTab?: AuthTab;
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

type AuthTab = 'register' | 'signin';

const validateNsec = (nsec: string) => /^nsec1[a-zA-Z0-9]{58}$/.test(nsec);
const validateBunkerUri = (uri: string) => uri.startsWith('bunker://');

/** Host of a NIP-46 challenge URL, so the user can see where a link they were
 *  handed by a remote signer actually leads. Null if it will not parse. */
const getChallengeHost = (url: string): string | null => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const LoginDialog: React.FC<LoginDialogProps> = ({ initialTab = 'register', isOpen, onClose, onLogin }) => {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bunkerError, setBunkerError] = useState<string | null>(null);
  const [bunkerUri, setBunkerUri] = useState('');
  const [bunkerAuthUrl, setBunkerAuthUrl] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [nsec, setNsec] = useState('');
  const [storedLocalNsec, setStoredLocalNsec] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const registrationRecordedRef = useRef(false);
  const login = useLoginActions();
  const { state: protectedMinorState } = useProtectedMinorStatus();
  // #182: while a protected-minor session is active (or its status is still
  // unknown — fail closed), this dialog must not surface raw-key affordances:
  // no nsec/key-file/bunker/extension import (the stored-nsec backup banner
  // gates itself). Signed-out visitors have no session token and resolve
  // not_protected, so the ordinary login paths are unaffected.
  const keyHandoverRestricted = isMinorKeyHandoverRestricted(protectedMinorState);
  // #182 command-boundary re-check (mirrors the divine-mobile #5991 review
  // finding): the render gates below hide the import affordances, but pending
  // continuations (the deferred nsec login timer, a FileReader callback, an
  // open native file picker) capture their closures before a live status
  // check can resolve `protected` mid-interaction. The ref always holds the
  // latest verdict so each signer-swap re-checks when it actually runs.
  const keyHandoverRestrictedRef = useRef(false);
  // LoginArea renders this dialog unconditionally and only toggles `isOpen`, so
  // dismissing it never unmounts the component and never settles an in-flight
  // bunker handshake. These track whether the attempt that is resolving is
  // still the one the user is waiting on.
  const isOpenRef = useRef(isOpen);
  const bunkerAttemptRef = useRef(0);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  keyHandoverRestrictedRef.current = keyHandoverRestricted;

  const recordRegistrationStarted = () => {
    if (registrationRecordedRef.current) return;

    registrationRecordedRef.current = true;
    const pathname = window.location.pathname;
    const entryPoint = pathname.startsWith('/invite')
      ? 'invite'
      : pathname === '/'
        ? 'landing'
        : 'unknown';
    void trackProductEvent('registration_started', {
      entry_point: entryPoint,
      ...getProductAnalyticsUtm(),
    });
  };

  useEffect(() => {
    if (!isOpen) {
      registrationRecordedRef.current = false;
      return;
    }
    if (initialTab === 'register') recordRegistrationStarted();
  }, [initialTab, isOpen]);

  // The render-side gates below stay closed synchronously; this only clears the
  // stale toggle state so the disclosure doesn't pop back open unprompted if
  // the restriction later lifts (e.g. a transient unknown that resolves).
  useEffect(() => {
    if (keyHandoverRestricted) {
      setAdvancedOpen(false);
    }
  }, [keyHandoverRestricted]);

  useEffect(() => {
    if (!isOpen) {
      // Retire any in-flight bunker attempt on close. Checking `isOpenRef`
      // alone is not enough: this effect re-arms it when the dialog is reopened
      // later, so an approval the user abandoned would land against a guard
      // that passes again. Bumping the counter means a superseded attempt can
      // never become current, whatever happens to `isOpen` afterwards, and it
      // also stops a stale challenge writing into the fresh dialog's state.
      bunkerAttemptRef.current++;
      return;
    }

    setAdvancedOpen(false);
    setBunkerError(null);
    setBunkerUri('');
    setBunkerAuthUrl(null);
    setGeneralError(null);
    setIsFileLoading(false);
    setIsLoginLoading(false);
    setKeyError(null);
    setNsec('');
    setStoredLocalNsec(getStoredLocalNsecLogin()?.data.nsec ?? null);
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  const handleExtensionLogin = async () => {
    if (keyHandoverRestrictedRef.current) return;
    setIsLoginLoading(true);
    setGeneralError(null);

    try {
      if (!('nostr' in window)) {
        throw new Error(t('loginDialog.errorExtensionNotFound'));
      }

      // The pre-click ref check above goes stale while the extension prompt is
      // open; the beforeCommit guard re-checks at the moment the signer would
      // be committed. Not committed → stop silently, like the nsec path.
      const committed = await login.extension({
        beforeCommit: () => !keyHandoverRestrictedRef.current,
      });
      if (!committed) return;
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
      if (keyHandoverRestrictedRef.current) {
        setIsLoginLoading(false);
        return;
      }
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

    if (keyHandoverRestrictedRef.current) return;
    setIsLoginLoading(true);
    setBunkerError(null);
    setBunkerAuthUrl(null);

    const attempt = ++bunkerAttemptRef.current;
    const isCurrentAttempt = () => attempt === bunkerAttemptRef.current;

    try {
      // Same commit-boundary re-check as the extension path: the pre-click
      // check goes stale while the bunker connect is pending.
      const committed = await login.bunker(bunkerUri, {
        // A NIP-46 handshake can sit unresolved indefinitely while the user
        // approves out of band, and the dialog stays mounted the whole time. If
        // they gave up and closed it, or started a fresh attempt, this one must
        // not silently log them in and set the cross-subdomain cookie.
        beforeCommit: () =>
          !keyHandoverRestrictedRef.current && isOpenRef.current && isCurrentAttempt(),
        // The signer wants the user to approve in its own UI. We open a tab
        // for them; keep the URL around in case the popup was blocked.
        onAuthChallenge: ({ url, opened }) => {
          if (url && !opened && isCurrentAttempt()) setBunkerAuthUrl(url);
        },
      });
      if (!committed) return;
      onLogin();
      onClose();
      setBunkerUri('');
      setBunkerAuthUrl(null);
    } catch {
      if (isCurrentAttempt()) setBunkerError(t('loginDialog.errorBunkerConnectFailed'));
    } finally {
      // A superseded attempt settling must not clear the spinner belonging to
      // the attempt the user is actually waiting on.
      if (isCurrentAttempt()) setIsLoginLoading(false);
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

  const handleRegister = async () => {
    setGeneralError(null);
    setIsLoginLoading(true);

    try {
      const returnPath = `${window.location.pathname}${window.location.search}`;
      const redirect = await buildSignupRedirect({ returnPath });
      window.location.assign(redirect.url);
    } catch (caughtError) {
      setGeneralError(caughtError instanceof Error ? caughtError.message : t('loginDialog.errorSignUpStartFailed'));
      setIsLoginLoading(false);
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

  const handleAuthTabChange = (value: string) => {
    const nextTab = value === 'signin' ? 'signin' : 'register';
    setActiveTab(nextTab);
    if (nextTab === 'register') recordRegistrationStarted();
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
              ? t('loginDialog.subtitleCreate')
              : t('loginDialog.subtitleSignIn')}
          </p>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-6 pt-2">
          {/* #182: the banner gates itself for protected minors. It must render
              unconditionally here so a restricted flip keeps it mounted
              (rendering null) and its command-boundary re-checks stay live; a
              gate at this level would unmount it mid-flight (dcadenas review
              on #476). */}
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
              <Button className="w-full rounded-full py-3" disabled={isLoginLoading} onClick={handleRegister}>
                {isLoginLoading ? t('loginDialog.creatingAccount') : t('loginDialog.createAccountButton')}
              </Button>
            </TabsContent>

            <TabsContent className="space-y-4" value="signin">
              <WebAccountSignInForm
                advancedOpen={advancedOpen}
                isLoading={isLoginLoading}
                onContinue={handleExistingAccountLogin}
                onToggleAdvanced={() => setAdvancedOpen((current) => !current)}
                showNostrOptions={!keyHandoverRestricted}
              />

              <Collapsible open={advancedOpen && !keyHandoverRestricted}>
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
                        {bunkerAuthUrl ? (
                          <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">{t('loginDialog.bunkerAuthPrompt')}</p>
                            <a
                              className="font-medium underline underline-offset-2"
                              href={bunkerAuthUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {t('loginDialog.bunkerAuthLink')}
                            </a>
                            {/* The remote signer chooses this URL, so show where
                                the link actually goes rather than hiding an
                                arbitrary destination behind our own wording.
                                A hostname is data, not copy, so no locale
                                needs updating. */}
                            {getChallengeHost(bunkerAuthUrl) ? (
                              <span className="ml-1 text-muted-foreground break-all">
                                ({getChallengeHost(bunkerAuthUrl)})
                              </span>
                            ) : null}
                          </div>
                        ) : null}
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
