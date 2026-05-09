import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { buildSecureAccountRedirect } from '@/lib/divineLogin';
import { buildNsecDownload } from '@/lib/localNsecAccount';

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

  const handleBackUp = async () => {
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
    const returnPath = `${window.location.pathname}${window.location.search}`;
    const redirect = await buildSecureAccountRedirect(nsec, { returnPath });
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
