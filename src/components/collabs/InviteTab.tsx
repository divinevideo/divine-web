import { useState } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { InviteCollaboratorsDialog } from './InviteCollaboratorsDialog';
import { SHORT_VIDEO_KIND } from '@/lib/collabsParser';

// Re-fetches the user's own kind 34236 events directly from the relay so we have the
// full event (not just a Funnelcake projection) for republishing.
function useMyVideoEvents() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['user-videos-events', user?.pubkey],
    enabled: !!user?.pubkey,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [SHORT_VIDEO_KIND], authors: [user!.pubkey], limit: 100 }],
        { signal },
      );
      const byDTag = new Map<string, NostrEvent>();
      for (const e of events) {
        const d = e.tags.find((t) => t[0] === 'd')?.[1];
        if (!d) continue;
        const prev = byDTag.get(d);
        if (!prev || prev.created_at < e.created_at) byDTag.set(d, e);
      }
      return [...byDTag.values()].sort((a, b) => b.created_at - a.created_at);
    },
  });
}

export function InviteTab() {
  const { data, isPending } = useMyVideoEvents();
  const [selected, setSelected] = useState<NostrEvent | null>(null);

  if (isPending) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-video animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border p-6 text-center text-muted-foreground">
        You haven't published any videos yet. Once you do, they'll show up here.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.map((video) => {
          const title = video.tags.find((t) => t[0] === 'title')?.[1] ?? 'Untitled';
          return (
            <Card
              key={video.id}
              className="cursor-pointer p-3"
              onClick={() => setSelected(video)}
            >
              <p className="font-semibold truncate">{title}</p>
            </Card>
          );
        })}
      </div>
      {selected && (
        <InviteCollaboratorsDialog
          video={selected}
          open={true}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
        />
      )}
    </>
  );
}
