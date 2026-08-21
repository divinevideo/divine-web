// ABOUTME: Page component for viewing individual video lists
// ABOUTME: Shows list details, videos in the list, and allows editing for list owners

import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { nip19 } from 'nostr-tools';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useRemoveVideoFromList, useDeleteVideoList } from '@/hooks/useVideoLists';
import { parseVideoListFromEvent, type PlayOrder, type VideoList } from '@/lib/parseVideoListFromEvent';
import { EditListDialog } from '@/components/EditListDialog';
import { DeleteListDialog } from '@/components/DeleteListDialog';
import { VideoGrid } from '@/components/VideoGrid';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, List, VideoCamera as Video, Clock, PencilSimple as Edit, ShareNetwork as Share2, Users, Shuffle, ArrowsDownUp as ArrowUpDown, DotsThreeVertical as MoreVertical, Trash as Trash2 } from '@phosphor-icons/react';
import { genUserName } from '@/lib/genUserName';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { useShare } from '@/hooks/useShare';
import { useAppContext } from '@/hooks/useAppContext';
import { getListShareData } from '@/lib/shareUtils';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { getEventLookupRelayUrls } from '@/config/relays';
import { fetchListVideos } from '@/lib/listVideos';
import { resolveListPermissions } from '@/lib/listPermissions';

const PlayOrderIcon = ({ order }: { order?: PlayOrder }) => {
  switch (order) {
    case 'shuffle':
      return <Shuffle className="h-4 w-4" />;
    case 'reverse':
      return <ArrowUpDown className="h-4 w-4" />;
    case 'manual':
      return <List className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const PlayOrderLabel = ({ order }: { order?: PlayOrder }) => {
  const { t } = useTranslation();
  switch (order) {
    case 'shuffle':
      return t('listDetailPage.playOrderShuffle');
    case 'reverse':
      return t('listDetailPage.playOrderReverse');
    case 'manual':
      return t('listDetailPage.playOrderManual');
    default:
      return t('listDetailPage.playOrderChronological');
  }
};

function getReadableAuthorName(profileName: string | undefined, pubkey: string): string {
  const trimmedName = profileName?.trim();
  if (trimmedName && !/^[0-9a-f]{64}$/i.test(trimmedName)) {
    return trimmedName;
  }

  return genUserName(pubkey);
}

export default function ListDetailPage() {
  const { t } = useTranslation();
  const { pubkey, listId } = useParams<{ pubkey: string; listId: string }>();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const listLookupRelays = getEventLookupRelayUrls({
    configuredRelayUrls: [
      ...(config.relayUrls || [config.relayUrl]),
      ...(config.customRelayUrls ?? []),
    ],
    disabledRelayUrls: config.disabledPresetUrls,
  });
  const listLookupRelayKey = listLookupRelays.join(',');
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { share } = useShare();
  const removeVideo = useRemoveVideoFromList();
  const deleteList = useDeleteVideoList();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const listOwnerPubkey = pubkey || undefined;

  const handleDeleteList = async () => {
    if (!list || !listOwnerPubkey) return;
    setIsDeleting(true);
    try {
      await deleteList.mutateAsync({ listId: list.id, ownerPubkey: listOwnerPubkey });
      toast({
        title: t('listDetailPage.listDeletedTitle'),
        description: t('listDetailPage.listDeletedDescription', { name: list.name }),
      });
      setShowDeleteDialog(false);
      navigate('/lists');
    } catch (error) {
      toast({
        title: t('listDetailPage.errorTitle'),
        description: error instanceof Error ? error.message : t('listDetailPage.deleteFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Fetch list details
  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ['list-detail', pubkey, listId, listLookupRelayKey],
    queryFn: async (context) => {
      if (!pubkey || !listId) throw new Error(t('listDetailPage.invalidParamsError'));

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000)
      ]);

      const ownerEvents = await nostr.query([{
        kinds: [30005],
        authors: [pubkey],
        '#d': [listId],
        limit: 1
      }], {
        signal,
        relays: listLookupRelays,
      });

      if (ownerEvents.length === 0) {
        throw new Error(t('listDetailPage.notFoundError'));
      }

      const ownerList = parseVideoListFromEvent(ownerEvents[0]);
      if (!ownerList) {
        throw new Error(t('listDetailPage.notFoundError'));
      }

      if (!ownerList.isCollaborative || !ownerList.allowedCollaborators || ownerList.allowedCollaborators.length === 0) {
        return ownerList;
      }

      const participantPubkeys = Array.from(new Set([pubkey, ...ownerList.allowedCollaborators]));
      const participantEvents = await nostr.query([{
        kinds: [30005],
        authors: participantPubkeys,
        '#d': [listId],
        limit: 50,
      }], {
        signal,
        relays: listLookupRelays,
      });

      const participantSet = new Set(participantPubkeys);
      const latestList = participantEvents
        .map(parseVideoListFromEvent)
        .filter((candidate): candidate is VideoList => candidate !== null && participantSet.has(candidate.pubkey))
        .sort((a, b) => b.createdAt - a.createdAt)[0];

      return latestList || ownerList;
    },
    enabled: !!pubkey && !!listId
  });

  const permissions = resolveListPermissions({
    ownerPubkey: listOwnerPubkey,
    isCollaborative: list?.isCollaborative,
    allowedCollaborators: list?.allowedCollaborators,
  }, user?.pubkey);

  // Fetch videos in the list
  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ['list-videos', pubkey, listId, list?.members],
    queryFn: async (context) => {
      if (!list) return [];

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(10000)
      ]);

      return fetchListVideos(nostr, list.members, signal);
    },
    enabled: !!list
  });

  // Fetch author info
  const author = useAuthor(pubkey || '');
  const authorMetadata = author.data?.metadata;
  const authorName = getReadableAuthorName(
    authorMetadata?.display_name || authorMetadata?.name,
    pubkey || '',
  );
  const displayListName = list?.name === list?.id
    ? t('listDetailPage.untitledVideoList')
    : list?.name;
  const creatorNpub = pubkey ? nip19.npubEncode(pubkey) : '';

  const handleShare = () => {
    if (!pubkey || !listId) return;
    share(getListShareData(pubkey, listId));
  };

  if (listLoading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-full mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-10 w-32" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <List className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">{t('listDetailPage.notFoundTitle')}</p>
            <p className="text-muted-foreground mb-4">
              {t('listDetailPage.notFoundDescription')}
            </p>
            <Button onClick={() => navigate('/lists')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('listDetailPage.browseLists')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-8">
        <Link
          to={`/profile/${creatorNpub}/lists`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('listDetailPage.backToCreatorLists', { name: authorName })}
        </Link>

        <Card variant="brand" accent="violet" className="overflow-hidden">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
                <List className="h-5 w-5" aria-hidden="true" />
                <span>{t('listDetailPage.videoList')}</span>
              </div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-brand-dark-green dark:text-brand-off-white sm:text-4xl">
                {displayListName}
              </h1>
              {list.description && (
                <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
                  {list.description}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  to={`/profile/${creatorNpub}`}
                  aria-label={t('listDetailPage.byCreator', { name: authorName })}
                  className="inline-flex items-center gap-2 rounded-2xl font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar size="sm">
                    <AvatarImage src={getSafeProfileImage(authorMetadata?.picture)} />
                    <AvatarFallback>{authorName[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>{t('listDetailPage.byCreator', { name: authorName })}</span>
                </Link>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {formatDistanceToNow(list.createdAt * 1000, { addSuffix: true })}
                  </span>
                  {list.playOrder && (
                    <span className="inline-flex items-center gap-1.5">
                      <PlayOrderIcon order={list.playOrder} />
                      <PlayOrderLabel order={list.playOrder} />
                    </span>
                  )}
                  {list.isCollaborative && (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <Users className="h-4 w-4" aria-hidden="true" />
                      {t('listDetailPage.collaborative')}
                    </span>
                  )}
                </div>
              </div>

              {list.tags && list.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {list.tags.map(tag => (
                    <Badge key={tag} variant="secondary">#{tag}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 lg:flex-col lg:items-end">
              {list.image && (
                <img
                  src={list.image}
                  alt=""
                  className="h-24 w-24 rounded-[22px] border-2 border-brand-dark-green object-cover sm:h-32 sm:w-32"
                />
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {permissions.canEditMetadata && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t('listDetailPage.editList')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('listDetailPage.delete')}
                    </Button>
                  </>
                )}
                <Button variant="sticker" size="sm" onClick={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  {t('listDetailPage.share')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Videos Grid */}
        {videosLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded" />
            ))}
          </div>
        ) : videos && videos.length > 0 ? (
          <section aria-labelledby="list-videos-heading" className="space-y-4">
            <div>
              <h2 id="list-videos-heading" className="font-display text-2xl font-extrabold text-brand-dark-green dark:text-brand-off-white">
                {t('listDetailPage.videoCount', { count: videos.length })}
              </h2>
              <p className="text-sm text-muted-foreground">{t('listDetailPage.videosInList')}</p>
            </div>

            {permissions.canEditContent ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videos.map((video) => {
                  return (
                    <div key={video.id} className="relative group">
                      <VideoGrid
                        videos={[video]}
                        navigationContext={{
                          source: 'video-list',
                          pubkey: listOwnerPubkey || list.pubkey,
                          listId: list.id,
                          listName: displayListName,
                        }}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await removeVideo.mutateAsync({
                                    listId: list.id,
                                    ownerPubkey: listOwnerPubkey || list.pubkey,
                                    videoMember: video.listMember,
                                  });
                                  toast({
                                    title: t('listDetailPage.videoRemovedTitle'),
                                    description: t('listDetailPage.videoRemovedDescription'),
                                  });
                                } catch (error) {
                                  toast({
                                    title: t('listDetailPage.errorTitle'),
                                    description: error instanceof Error ? error.message : t('listDetailPage.removeVideoFailedDescription'),
                                    variant: 'destructive',
                                  });
                                }
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('listDetailPage.removeFromList')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <VideoGrid
                videos={videos}
                navigationContext={{
                  source: 'video-list',
                  pubkey: listOwnerPubkey || list.pubkey,
                  listId: list.id,
                  listName: displayListName,
                }}
              />
            )}
          </section>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t('listDetailPage.emptyList')}
              </p>
              {permissions.canEditContent && (
                <p className="text-sm text-muted-foreground mt-2">
                  {t('listDetailPage.emptyListOwnerHint')}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit List Dialog */}
      {list && showEditDialog && (
        <EditListDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          list={list}
        />
      )}

      {/* Delete List Dialog */}
      {list && showDeleteDialog && (
        <DeleteListDialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteList}
          listName={list.name}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
