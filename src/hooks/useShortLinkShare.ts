import { useCallback, useEffect, useMemo } from 'react';

import { useShare } from '@/hooks/useShare';
import { ShortLinkClient } from '@/lib/shortLinkClient';

export function useShortLinkShare() {
  const { share } = useShare();
  const enabled = import.meta.env.VITE_SHORT_LINKS_ENABLED !== 'false';
  const client = useMemo(() => new ShortLinkClient({ enabled }), [enabled]);
  useEffect(() => () => client.clear(), [client]);
  const prepare = useCallback((url: string) => client.prepare(url), [client]);
  const sharePrepared = useCallback((data: { url: string }) => (
    share({ url: client.cachedOrOriginal(data.url) })
  ), [client, share]);
  return { share: sharePrepared, prepare };
}
