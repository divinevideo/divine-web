// ABOUTME: Page component for viewing individual video lists
// ABOUTME: Shows list details, videos in the list, and allows editing for list owners

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { nip19 } from 'nostr-tools';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useDeleteVideoList } from '@/hooks/useVideoLists';
import { parseVideoListFromEvent, type PlayOrder, type VideoList } from '@/lib/parseVideoListFromEvent';
import { EditListDialog } from '@/components/EditListDialog';
import { DeleteListDialog } from '@/components/DeleteListDialog';
import { VideoListContent } from '@/components/VideoListContent';
import { PeopleListContent } from '@/components/PeopleListContent';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, List, VideoCamera as Video, Clock, PencilSimple as Edit, ShareNetwork as Share2, Users, Shuffle, ArrowsDownUp as ArrowUpDown, Trash as Trash2 } from '@phosphor-icons/react';
import { genUserName } from '@/lib/genUserName';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { useShare } from '@/hooks/useShare';
import { useAppContext } from '@/hooks/useAppContext';
import { getListShareData } from '@/lib/shareUtils';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { getEventLookupRelayUrls } from '@/config/relays';
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

export default function ListDetailPage() {
  const { t } = useTranslation();
  const { pubkey, listId } = useParams<{ pubkey: string; listId: string }>();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const listLookupRelayKey = (config.relayUrls || [config.relayUrl]).join(',');
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { share } = useShare();
  const deleteList = useDeleteVideoList();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const listOwnerPubkey = pubkey || undefined;
  const isOwner = user?.pubkey === pubkey;

  const handleDeleteList = async () => {
    if (!list || !listOwnerPubkey) return;
    setIsDeleting(true);
    try {
      await deleteList.mutateAsync({ listId: list.id, ownerPubkey: listOwnerPubkey });
      toast({
        title: t('listDetailPage.listDeletedTitle'),
        description: t('listDetailPage.listDeletedDescription', { name: list.name }),
      });
      navigate('/lists');
    } catch (error) {
      toast({
        title: t('listDetailPage.errorTitle'),
        description: error instanceof Error ? error.message : t('listDetailPage.deleteFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Fetch list details — return both the raw event (for kind dispatch) and
  // the parsed VideoList (used only for the kind-30005 / VideoListContent path).
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['list-detail', pubkey, listId, listLookupRelayKey],
    queryFn: async (context) => {
      if (!pubkey || !listId) throw new Error(t('listDetailPage.invalidParamsError'));

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000)
      ]);

      const ownerEvents = await nostr.query([{
        kinds: [30000, 30005],
        authors: [pubkey],
        '#d': [listId],
        limit: 1
      }], {
        signal,
        relays: getEventLookupRelayUrls({
          configuredRelayUrls: config.relayUrls || [config.relayUrl],
        }),
      });

      if (ownerEvents.length === 0) {
        throw new Error(t('listDetailPage.notFoundError'));
      }

      const event = ownerEvents[0];
      if (event.kind === 30000) {
        return { event, list: null };
      }

      const ownerList = parseVideoListFromEvent(event);
      if (!ownerList) {
        throw new Error(t('listDetailPage.notFoundError'));
      }

      if (!ownerList.isCollaborative || !ownerList.allowedCollaborators || ownerList.allowedCollaborators.length === 0) {
        return { event, list: ownerList };
      }

      const participantPubkeys = Array.from(new Set([pubkey, ...ownerList.allowedCollaborators]));
      const participantEvents = await nostr.query([{
        kinds: [30005],
        authors: participantPubkeys,
        '#d': [listId],
        limit: 50,
      }], {
        signal,
        relays: getEventLookupRelayUrls({
          configuredRelayUrls: config.relayUrls || [config.relayUrl],
        }),
      });

      const participantSet = new Set(participantPubkeys);
      const latestList = participantEvents
        .map(parseVideoListFromEvent)
        .filter((candidate): candidate is VideoList => candidate !== null && participantSet.has(candidate.pubkey))
        .sort((a, b) => b.createdAt - a.createdAt)[0];

      return { event, list: latestList || ownerList };
    },
    enabled: !!pubkey && !!listId
  });

  // Convenience aliases for the kind-30005 path
  const list = listData?.list ?? null;
  const rawEvent = listData?.event ?? null;

  const permissions = resolveListPermissions({
    ownerPubkey: listOwnerPubkey,
    isCollaborative: list?.isCollaborative,
    allowedCollaborators: list?.allowedCollaborators,
  }, user?.pubkey);

  // Fetch author info
  const author = useAuthor(pubkey || '');
  const authorMetadata = author.data?.metadata;
  const authorName = authorMetadata?.name || genUserName(pubkey || '');

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

  if (!listData) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <List className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">List not found</p>
            <p className="text-muted-foreground mb-4">
              This list may have been deleted or doesn't exist
            </p>
            <Button onClick={() => navigate('/lists')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Browse Lists
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // kind-30000: render the people-list detail view
  if (rawEvent && rawEvent.kind === 30000) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <PeopleListContent
          event={rawEvent}
          pubkey={pubkey || ''}
          dTag={listId || ''}
          isOwner={isOwner}
        />
      </div>
    );
  }

  // At this point we're in the kind-30005 (video curation) path.
  // If the event somehow parsed as null (malformed), bail to "not found".
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
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/lists')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('listDetailPage.backToLists')}
        </Button>

        {/* List Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <List className="h-6 w-6" />
                  {list.name}
                </CardTitle>
                {list.description && (
                  <CardDescription className="mt-2">
                    {list.description}
                  </CardDescription>
                )}
              </div>
              {list.image && (
                <img
                  src={list.image}
                  alt={list.name}
                  className="w-24 h-24 rounded object-cover ml-4"
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Author and stats */}
              <div className="space-y-3">
                <a
                  href={`/profile/${pubkey ? nip19.npubEncode(pubkey) : ''}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Avatar size="sm">
                    <AvatarImage src={getSafeProfileImage(authorMetadata?.picture)} />
                    <AvatarFallback>{authorName[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{authorName}</p>
                    <p className="text-xs text-muted-foreground">{t('listDetailPage.listCreator')}</p>
                  </div>
                </a>

                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <Video className="h-4 w-4" />
                    <span>{t('listDetailPage.videoCount', { count: list.videoCoordinates.length })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDistanceToNow(list.createdAt * 1000, { addSuffix: true })}</span>
                  </div>
                  {list.playOrder && (
                    <div className="flex items-center gap-1">
                      <PlayOrderIcon order={list.playOrder} />
                      <span><PlayOrderLabel order={list.playOrder} /></span>
                    </div>
                  )}
                  {list.isCollaborative && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Users className="h-4 w-4" />
                      <span>{t('listDetailPage.collaborative')}</span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {list.tags && list.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {list.tags.map(tag => (
                      <Badge key={tag} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {permissions.canEditMetadata && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('listDetailPage.editList')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('listDetailPage.delete')}
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  {t('listDetailPage.share')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Videos Grid — kind 30005 only; kind 30000 is handled in Task 6.5b */}
        {listId && (
          <VideoListContent
            list={list}
            pubkey={listOwnerPubkey || list.pubkey}
            dTag={listId}
          />
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
