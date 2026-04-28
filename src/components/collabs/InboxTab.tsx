import { useCollabInvites } from '@/hooks/useCollabInvites';
import { useApproveCollab } from '@/hooks/useApproveCollab';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PendingInviteCard } from './PendingInviteCard';

export function InboxTab() {
  const { user } = useCurrentUser();
  const { data, isPending, isError, refetch } = useCollabInvites();
  const approve = useApproveCollab();

  if (!user) return null;
  if (isPending) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-2xl border p-6 text-center">
        <p>Couldn't load invites.</p>
        <button className="mt-2 underline" onClick={() => refetch()}>Try again</button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border p-6 text-center text-muted-foreground">
        Inbox zero. Nothing waiting on you.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((video) => (
        <PendingInviteCard
          key={video.id}
          video={video}
          myPubkey={user.pubkey}
          approving={approve.isPending}
          onApprove={(args) => approve.mutate(args)}
        />
      ))}
    </div>
  );
}
