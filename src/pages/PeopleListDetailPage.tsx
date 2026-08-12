// ABOUTME: Public detail page for a NIP-51 people list with member videos as primary content

import { ArrowLeft, Clock, PencilSimple, ShareNetwork, Trash, UsersThree, VideoCamera } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { nip19 } from 'nostr-tools';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DeleteListDialog } from '@/components/DeleteListDialog';
import { EditPeopleListDialog } from '@/components/EditPeopleListDialog';
import { PeopleListMembers } from '@/components/PeopleListMembers';
import { VideoGrid } from '@/components/VideoGrid';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDeletePeopleList } from '@/hooks/usePeopleListMutations';
import { usePeopleList } from '@/hooks/usePeopleLists';
import { usePeopleListVideos } from '@/hooks/usePeopleListVideos';
import { useShare } from '@/hooks/useShare';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { buildProfileLinkPath } from '@/lib/profileLinks';
import { getPeopleListShareData } from '@/lib/shareUtils';

function LoadMoreButton({
  isFetching,
  onClick,
  className,
}: {
  isFetching: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      className={className}
      variant="outline"
      onClick={onClick}
      disabled={isFetching}
    >
      {isFetching ? 'Loading...' : 'Load more'}
    </Button>
  );
}

function PeopleListContent({ pubkey, listId }: { pubkey: string; listId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const listQuery = usePeopleList(pubkey, listId);
  const author = useAuthor(pubkey);
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { share } = useShare();
  const deletePeopleList = useDeletePeopleList();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const memberPubkeys = listQuery.data?.memberPubkeys ?? [];
  const videosQuery = usePeopleListVideos(memberPubkeys);
  const videos = videosQuery.data?.pages.flatMap((page) => page.videos) ?? [];
  const authorMetadata = author.data?.metadata;
  const authorName = authorMetadata?.display_name || authorMetadata?.name || genUserName(pubkey);
  const isOwner = user?.pubkey === pubkey;

  const handleShare = () => {
    share(getPeopleListShareData(pubkey, listId));
  };

  const handleDelete = async () => {
    if (!listQuery.data) return;

    try {
      await deletePeopleList.mutateAsync({ listId });
      toast({
        title: t('peopleListDetailPage.deletedTitle'),
        description: t('peopleListDetailPage.deletedDescription', { name: listQuery.data.name }),
      });
      navigate(`/profile/${nip19.npubEncode(pubkey)}/lists`);
    } catch (error) {
      toast({
        title: t('peopleListDetailPage.deleteFailedTitle'),
        description: error instanceof Error ? error.message : t('peopleListDetailPage.deleteFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setShowDeleteDialog(false);
    }
  };

  if (listQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (listQuery.isError || (listQuery.isFetched && !listQuery.data)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <SectionHeader className="text-2xl">That people list could not be found.</SectionHeader>
      </div>
    );
  }

  const list = listQuery.data;
  if (!list) return null;

  return (
    <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
      <Link
        to={`/profile/${nip19.npubEncode(pubkey)}/lists`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to lists
      </Link>

      <header className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-light-green dark:bg-brand-dark-green">
              <UsersThree className="h-7 w-7 text-brand-dark-green dark:text-brand-green" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">People list</p>
              <SectionHeader as="h2" className="text-3xl">{list.name}</SectionHeader>
              {list.description && <p className="mt-2 text-muted-foreground">{list.description}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {isOwner && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                  <PencilSimple className="mr-2 h-4 w-4" />
                  {t('peopleListDetailPage.editList')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
                  <Trash className="mr-2 h-4 w-4" />
                  {t('peopleListDetailPage.delete')}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleShare}>
              <ShareNetwork className="mr-2 h-4 w-4" />
              {t('peopleListDetailPage.share')}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to={buildProfileLinkPath({
              pubkey,
              nip05: authorMetadata?.nip05,
              fallbackRoute: 'profile',
            })}
            className="flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar size="sm">
              <AvatarImage src={getSafeProfileImage(authorMetadata?.picture)} alt="" />
              <AvatarFallback>{authorName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span>
              <span className="block text-sm font-semibold">{authorName}</span>
              <span className="block text-xs text-muted-foreground">List creator</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UsersThree className="h-4 w-4" />
              {list.memberPubkeys.length} {list.memberPubkeys.length === 1 ? 'person' : 'people'}
            </span>
            <span className="inline-flex items-center gap-1">
              <VideoCamera className="h-4 w-4" />
              {videos.length} {videos.length === 1 ? 'loop' : 'loops'} loaded
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDistanceToNow(list.createdAt * 1000, { addSuffix: true })}
            </span>
          </div>
        </div>
      </header>

      <PeopleListMembers pubkeys={list.memberPubkeys} />

      <section aria-labelledby="people-list-videos-heading" className="space-y-4">
        <div>
          <SectionHeader id="people-list-videos-heading" className="text-2xl">Videos</SectionHeader>
          <p className="text-sm text-muted-foreground">Recent loops from everyone in this list.</p>
        </div>
        {list.memberPubkeys.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            Add people to this list and their loops will land here.
          </p>
        ) : videosQuery.isLoading ? (
          <VideoGrid videos={[]} loading />
        ) : videosQuery.isError ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            <p>These loops did not load.</p>
            <Button className="mt-4" variant="outline" onClick={() => videosQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : videos.length > 0 ? (
          <>
            <VideoGrid
              videos={videos}
              navigationContext={{ source: 'people-list', pubkey, listId }}
            />
            {videosQuery.hasNextPage && (
              <div className="flex justify-center">
                <LoadMoreButton
                  isFetching={videosQuery.isFetchingNextPage}
                  onClick={() => videosQuery.fetchNextPage()}
                />
              </div>
            )}
          </>
        ) : videosQuery.hasNextPage ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            <p>More loops may be hiding on the next page.</p>
            <LoadMoreButton
              className="mt-4"
              isFetching={videosQuery.isFetchingNextPage}
              onClick={() => videosQuery.fetchNextPage()}
            />
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            No loops from these people yet.
          </p>
        )}
      </section>

      {showEditDialog && (
        <EditPeopleListDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          list={list}
        />
      )}

      {showDeleteDialog && (
        <DeleteListDialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          listName={list.name}
          isDeleting={deletePeopleList.isPending}
          listKind="people"
        />
      )}
    </div>
  );
}

export default function PeopleListDetailPage() {
  const { pubkey, listId } = useParams<{ pubkey: string; listId: string }>();
  const isValidPubkey = Boolean(pubkey && /^[0-9a-fA-F]{64}$/.test(pubkey));

  if (!isValidPubkey || !pubkey || !listId) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <SectionHeader className="text-2xl">That people list link is not valid.</SectionHeader>
      </div>
    );
  }

  return <PeopleListContent pubkey={pubkey} listId={listId} />;
}
