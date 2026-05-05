// ABOUTME: Lists tab for the ProfilePage — shows all people and video lists owned by a user
// ABOUTME: Sorted by recency (most recently created first) across both list kinds

import { useState } from 'react';
import { useUnifiedLists } from '@/hooks/useUnifiedLists';
import { UnifiedListCard } from '@/components/UnifiedListCard';
import { CreatePeopleListDialog } from '@/components/CreatePeopleListDialog';
import { Button } from '@/components/ui/button';

interface ProfileListsTabProps {
  pubkey: string;
  isOwn: boolean;
}

export function ProfileListsTab({ pubkey, isOwn }: ProfileListsTabProps) {
  const { people, video, isLoading } = useUnifiedLists(pubkey);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Merge both list kinds and sort by recency (newest first)
  const allLists = [
    ...people.map(list => ({ kind: 30000 as const, list, createdAt: list.createdAt })),
    ...video.map(list => ({ kind: 30005 as const, list, createdAt: list.createdAt })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Loading lists...
      </div>
    );
  }

  if (allLists.length === 0) {
    return (
      <div className="space-y-4">
        {isOwn && (
          <>
            <div className="flex justify-start">
              <Button variant="sticker" onClick={() => setCreateDialogOpen(true)}>
                + Create new list
              </Button>
            </div>
            <CreatePeopleListDialog
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
            />
          </>
        )}
        <div className="py-12 text-center text-muted-foreground text-sm">
          No lists yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isOwn && (
        <>
          <div className="flex justify-start">
            <Button variant="sticker" onClick={() => setCreateDialogOpen(true)}>
              + Create new list
            </Button>
          </div>
          <CreatePeopleListDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
          />
        </>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {allLists.map(({ kind, list }) => (
          <UnifiedListCard key={`${kind}:${list.id}`} kind={kind} list={list} />
        ))}
      </div>
    </div>
  );
}
