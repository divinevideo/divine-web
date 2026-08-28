// ABOUTME: Explains account-key ownership and exports hosted keys after explicit confirmation
// ABOUTME: Keeps revealed secrets transient and cancels stale exports when identity changes

import { Copy, EyeSlash, WarningCircle } from "@phosphor-icons/react";
import { nip19 } from "nostr-tools";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { LocalNsecBanner } from "@/components/auth/LocalNsecBanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { exportAccountKey, KeyExportError } from "@/lib/exit/keyExportClient";

interface AccountKeySectionProps {
  pubkey: string | undefined;
  hostedToken: string | null;
  localNsec: string | null;
}

function retryCopy(retryAfterMs?: number): string {
  if (!retryAfterMs) return "Too many attempts. Wait a bit, then try again.";
  return `Too many attempts. Try again in about ${retrySeconds(retryAfterMs)} seconds.`;
}

function retrySeconds(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1_000));
}

function exportFailureMessage(error: KeyExportError): string {
  switch (error.code) {
    case "email-unverified":
      return "Verify the email on this account, then try again.";
    case "invalid-password":
      return "That password did not match this account.";
    case "auth-required":
      return "Your Divine session expired. Sign in again, then return here.";
    case "rate-limited":
      return retryCopy(error.retryAfterMs);
    case "no-hosted-key":
      return "Divine does not hold a secret key for this account.";
    case "service-unavailable":
      return error.retryAfterMs
        ? `The key service is busy. Try again in about ${retrySeconds(error.retryAfterMs)} seconds.`
        : "The key service is busy right now. Try again shortly.";
    case "network-failure":
      return "Divine could not be reached. Check your connection and try again.";
    case "malformed-response":
      return "Divine returned a response this page could not use. Try again.";
    case "cancelled":
    case "policy-denied":
      return "";
  }
}

export function AccountKeySection(props: AccountKeySectionProps) {
  const { pubkey, hostedToken, localNsec } = props;
  const passwordId = useId();
  const confirmationId = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nsec, setNsec] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const attempt = useRef(0);
  const npub = pubkey ? nip19.npubEncode(pubkey) : null;
  const isHostedAccount = !!hostedToken && !!pubkey;

  useEffect(() => {
    attempt.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setConfirmed(false);
    setLoading(false);
    setNsec(null);
    setRestricted(false);
    setFailure(null);
    setCopyStatus(null);

    return () => {
      attempt.current += 1;
      activeRequest.current?.abort();
    };
  }, [pubkey, isHostedAccount]);

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus(`${label} could not be copied. Select it and copy it manually.`);
    }
  }

  function hideSecret() {
    attempt.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    setNsec(null);
    setFailure(null);
  }

  async function revealSecret(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hostedToken || !confirmed) return;

    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const password = String(new FormData(form).get("password") ?? "");
    form.reset();
    setConfirmed(false);

    activeRequest.current?.abort();
    const controller = new AbortController();
    const requestAttempt = ++attempt.current;
    activeRequest.current = controller;
    setLoading(true);
    setFailure(null);
    setNsec(null);

    try {
      const result = await exportAccountKey({
        token: hostedToken,
        password,
        signal: controller.signal,
      });
      if (attempt.current === requestAttempt && !controller.signal.aborted) {
        setNsec(result.nsec);
      }
    } catch (error) {
      if (attempt.current !== requestAttempt || controller.signal.aborted) return;
      if (error instanceof KeyExportError && error.code === "policy-denied") {
        setRestricted(true);
      } else if (error instanceof KeyExportError) {
        setFailure(exportFailureMessage(error));
      } else {
        setFailure("The secret key could not be shown. Try again.");
      }
    } finally {
      if (attempt.current === requestAttempt) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <div className="space-y-5">
      <Card variant="brand" accent={restricted ? "orange" : "blue"}>
        <CardContent className="space-y-5 pt-6 text-base leading-relaxed text-muted-foreground">
          {npub ? (
            <div className="space-y-2">
              <p className="font-medium text-foreground">Your public key</p>
              <p className="break-all font-mono text-sm text-foreground">{npub}</p>
              <Button type="button" variant="outline" onClick={() => void copyValue(npub, "Public key")}>
                <Copy className="mr-2 h-4 w-4" />
                Copy public key
              </Button>
            </div>
          ) : (
            <p>Sign in to see the public key for your account.</p>
          )}

          {isHostedAccount ? (
            restricted ? (
              <Alert className="border-brand-orange/50 bg-brand-orange/10">
                <WarningCircle className="h-5 w-5" weight="fill" />
                <AlertTitle>Secret-key export is restricted</AlertTitle>
                <AlertDescription>
                  This account cannot export its secret key. You can still download your archive,
                  move your media, republish your posts, and publish pointers to your new home.
                </AlertDescription>
              </Alert>
            ) : nsec ? (
              <div className="space-y-3">
                <p className="font-medium text-foreground">Your secret key</p>
                <p data-sentry-mask className="break-all font-mono text-sm text-foreground">{nsec}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="sticker" onClick={() => void copyValue(nsec, "Secret key")}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy secret key
                  </Button>
                  <Button type="button" variant="outline" onClick={hideSecret}>
                    <EyeSlash className="mr-2 h-4 w-4" />
                    Hide secret key
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={(event) => void revealSecret(event)}>
                <div className="space-y-2">
                  <p>
                    Divine holds this account&apos;s key for signing. Confirm your account password
                    to reveal it here. Before typing it, check that your address bar shows divine.video.
                  </p>
                  <label className="font-medium text-foreground" htmlFor={passwordId}>
                    Divine account password
                  </label>
                  <Input
                    autoComplete="current-password"
                    disabled={loading}
                    id={passwordId}
                    name="password"
                    required
                    type="password"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <input
                    checked={confirmed}
                    className="mt-1 h-4 w-4 accent-primary"
                    disabled={loading}
                    id={confirmationId}
                    onChange={(event) => setConfirmed(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <label htmlFor={confirmationId}>
                    I understand this secret key is the password to my account. It can never be
                    reset, and nobody can recover it for me.
                  </label>
                </div>
                <Button disabled={!confirmed || loading} type="submit" variant="sticker">
                  {loading ? "Checking password..." : "Show my secret key"}
                </Button>
              </form>
            )
          ) : localNsec && pubkey ? (
            <div className="space-y-3">
              <p>
                This account has its own key, stored in this browser rather than on a Divine server.
                Keep a copy somewhere safe. If it is lost, nobody can restore it for you.
              </p>
            </div>
          ) : pubkey ? (
            <div className="space-y-3">
              <p>
                This account signs through a browser extension or another signer. This page cannot
                reveal a key it does not hold.
              </p>
              <p>
                Your public identity stays yours. Signing new events depends on whichever signer
                this account uses, while everything in your downloaded archive stays verifiable.
              </p>
            </div>
          ) : null}

          {localNsec && pubkey ? <LocalNsecBanner nsec={localNsec} /> : null}

          {failure ? <p role="alert" className="text-destructive">{failure}</p> : null}
          {copyStatus ? <p role="status" className="text-sm">{copyStatus}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
