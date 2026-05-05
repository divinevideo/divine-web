import { useEffect } from 'react';

import { MERCH_STORE_URL } from '@/lib/externalLinks';

type MerchRedirectPageProps = {
  redirect?: (url: string) => void;
};

export function MerchRedirectPage({
  redirect = (url) => window.location.assign(url),
}: MerchRedirectPageProps) {
  useEffect(() => {
    redirect(MERCH_STORE_URL);
  }, [redirect]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
      <a className="text-primary underline" href={MERCH_STORE_URL}>
        Open merch store
      </a>
    </main>
  );
}
