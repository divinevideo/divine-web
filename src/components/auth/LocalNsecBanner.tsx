import { useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';
import { buildSecureAccountRedirect } from '@/lib/divineLogin';
import { buildNsecDownload } from '@/lib/localNsecAccount';
import { isMinorKeyHandoverRestricted } from '@/lib/protectedMinor';

interface LocalNsecBannerProps {
  nsec: string;
}

function downloadBackup(nsec: string): boolean {
  if (typeof URL.createObjectURL !== 'function') {
    return false;
  }

  const anchor = document.createElement('a');
  const blob = new Blob([buildNsecDownload(nsec)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  anchor.href = url;
  anchor.download = 'divine-nsec-backup.txt';
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function LocalNsecBanner(props: LocalNsecBannerProps) {
  const { nsec } = props;
  const [status, setStatus] = useState<string | null>(null);
  const { state: protectedMinorState } = useProtectedMinorStatus();
  // #182 command-boundary re-check (mirrors the divine-mobile #5991 review
  // finding): render-time gating in the parents decides whether this banner
  // shows, but a pending continuation (the secure-redirect await below)
  // captures its closure before a live status check can resolve `protected`
  // mid-interaction. A ref always holds the latest verdict, so each raw-key
  // handover re-checks at the moment it happens, and a stale-rendered banner
  // under a future ungated parent cannot hand the key over either.
  const keyHandoverRestrictedRef = useRef(false);
  keyHandoverRestrictedRef.current = isMinorKeyHandoverRestricted(protectedMinorState);

  const handleBackUp = async () => {
    if (keyHandoverRestrictedRef.current) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(nsec);
        setStatus('Secret key copied. Stash it somewhere safe.');
        return;
      }
    } catch {
      // Fall through to file download when clipboard access is unavailable.
    }

    const didDownload = downloadBackup(nsec);
    setStatus(didDownload
      ? 'Backup file downloaded. Stash it somewhere safe.'
      : 'Backup ready. Stash it somewhere safe.');
  };

  const handleSecure = async () => {
    if (keyHandoverRestrictedRef.current) return;
    const returnPath = `${window.location.pathname}${window.location.search}`;
    const redirect = await buildSecureAccountRedirect(nsec, { returnPath });
    // Re-check after the await: the nsec leaves the app in this URL.
    if (keyHandoverRestrictedRef.current) return;
    window.location.assign(redirect.url);
  };

  return (
    <Alert className="border-brand-green/30 bg-brand-light-green/40 dark:bg-brand-dark-green/20">
      <AlertDescription className="space-y-3">
        <div className="space-y-1">
          <p className="font-medium text-foreground">This account only lives in your browser.</p>
          <p className="text-sm text-muted-foreground">
            Back it up or lock it down with a Divine login — local storage is not forever.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            className="h-auto w-full whitespace-normal rounded-full py-2 text-center leading-tight"
            onClick={() => void handleSecure()}
            type="button"
          >
            Secure with divine.video login
          </Button>
          <Button
            className="h-auto w-full whitespace-normal rounded-full py-2 text-center leading-tight"
            onClick={() => void handleBackUp()}
            type="button"
            variant="outline"
          >
            Back up nsec
          </Button>
        </div>
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </AlertDescription>
    </Alert>
  );
}

export default LocalNsecBanner;
