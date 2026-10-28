import type { NostrSigner } from '@nostrify/nostrify';
import { useCallback, useEffect, useMemo } from 'react';

import { useShare } from '@/hooks/useShare';
import { createNip98AuthHeader } from '@/lib/nip98Auth';
import { ShortLinkClient } from '@/lib/shortLinkClient';

export function useShortLinkShare(signer?: NostrSigner) {
  const { share } = useShare();
  const enabled = import.meta.env.VITE_SHORT_LINKS_ENABLED !== 'false' && !!signer;
  const client = useMemo(() => new ShortLinkClient({
    enabled,
    authorize: (endpoint, body) => signer
      ? createNip98AuthHeader(signer, endpoint, 'POST', body)
      : Promise.resolve(null),
  }), [enabled, signer]);
  useEffect(() => () => client.clear(), [client]);
  const prepare = useCallback((url: string) => client.prepare(url), [client]);
  const sharePrepared = useCallback((data: { url: string }) => (
    share({ url: client.cachedOrOriginal(data.url) })
  ), [client, share]);
  return { share: sharePrepared, prepare };
}
