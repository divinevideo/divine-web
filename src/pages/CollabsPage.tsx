import { useParams, Link } from 'react-router-dom';
import { InboxTab } from '@/components/collabs/InboxTab';
import { InviteTab } from '@/components/collabs/InviteTab';
import { ConfirmedTab } from '@/components/collabs/ConfirmedTab';
import { Button } from '@/components/ui/button';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

type Tab = 'inbox' | 'invite' | 'confirmed';

const TABS: { key: Tab; label: string }[] = [
  { key: 'inbox',     label: 'Inbox' },
  { key: 'invite',    label: 'Invite' },
  { key: 'confirmed', label: 'Confirmed' },
];

export function CollabsPage() {
  const { tab } = useParams<{ tab?: Tab }>();
  const { user } = useCurrentUser();
  const { openLoginDialog } = useLoginDialog();
  const active: Tab = (tab && TABS.some((t) => t.key === tab)) ? tab : 'inbox';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Collabs</h1>

      {!user ? (
        <div className="rounded-2xl border p-6 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Sign in to approve invites and add collaborators to your videos.
          </p>
          <Button onClick={openLoginDialog}>Sign in to manage collabs</Button>
        </div>
      ) : (
        <>
          <nav className="mb-6 flex gap-1 border-b">
            {TABS.map((t) => (
              <Link
                key={t.key}
                to={`/collabs/${t.key}`}
                className={cn(
                  'px-3 py-2 text-sm border-b-2',
                  active === t.key
                    ? 'border-foreground font-medium'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          {active === 'inbox' && <InboxTab />}
          {active === 'invite' && <InviteTab />}
          {active === 'confirmed' && <ConfirmedTab />}
        </>
      )}
    </div>
  );
}

export default CollabsPage;
