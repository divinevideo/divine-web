// ABOUTME: Renders the content area for a kind-30000 people list detail page
// ABOUTME: Shows PeopleListDetailHeader + PeopleListVideosGrid (videos from all members)

import { useNavigate } from 'react-router-dom';
import { PeopleListDetailHeader } from '@/components/PeopleListDetailHeader';
import { PeopleListVideosGrid } from '@/components/PeopleListVideosGrid';
import { parsePeopleList } from '@/types/peopleList';
import { usePeopleListStats } from '@/hooks/usePeopleListStats';
import { useSavedLists } from '@/hooks/useSavedLists';
import { useSaveList, useUnsaveList } from '@/hooks/useSavedListsMutations';
import { buildListEditPath } from '@/lib/eventRouting';
import type { NostrEvent } from '@nostrify/nostrify';

interface Props {
  event: NostrEvent;
  pubkey: string;
  dTag: string;
  isOwner: boolean;
}

export function PeopleListContent({ event, pubkey, dTag, isOwner }: Props) {
  const navigate = useNavigate();

  const list = parsePeopleList(event);

  const { data: stats } = usePeopleListStats(pubkey, dTag);
  const { data: savedRefs = [] } = useSavedLists();
  const saveList = useSaveList();
  const unsaveList = useUnsaveList();

  const isFollowing = savedRefs.some(
    (ref) => ref.kind === 30000 && ref.pubkey === pubkey && ref.dTag === dTag,
  );

  const handleFollowToggle = () => {
    if (isFollowing) {
      unsaveList.mutate({ kind: 30000, pubkey, dTag });
    } else {
      saveList.mutate({ kind: 30000, pubkey, dTag });
    }
  };

  const handleEdit = () => {
    navigate(buildListEditPath(pubkey, dTag));
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (!list) return null;

  return (
    <div className="space-y-4">
      <PeopleListDetailHeader
        pubkey={pubkey}
        dTag={dTag}
        list={list}
        stats={stats}
        isOwner={isOwner}
        isFollowing={isFollowing}
        onFollowToggle={handleFollowToggle}
        onEdit={handleEdit}
        onBack={handleBack}
      />

      <PeopleListVideosGrid pubkey={pubkey} dTag={dTag} />
    </div>
  );
}
