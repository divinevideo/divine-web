// ABOUTME: Dialog component for adding videos to lists
// ABOUTME: Allows users to select existing lists or create new ones

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVideoLists, useAddVideoToList, useCreateVideoList, useVideosInLists } from '@/hooks/useVideoLists';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, List, Check, CircleNotch as Loader2, ArrowSquareOut as ExternalLink } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { SHORT_VIDEO_KIND } from '@/types/video';

interface AddToListDialogProps {
  videoId: string;
  videoPubkey: string;
  open: boolean;
  onClose: () => void;
}

export function AddToListDialog({
  videoId,
  videoPubkey,
  open,
  onClose
}: AddToListDialogProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userLists, isLoading: listsLoading } = useVideoLists(user?.pubkey);
  const { data: publicLists, isLoading: publicListsLoading } = useVideosInLists(videoId);
  const addToList = useAddVideoToList();
  const createList = useCreateVideoList();

  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const videoCoordinate = `${SHORT_VIDEO_KIND}:${videoPubkey}:${videoId}`;

  const handleAddToLists = async () => {
    if (selectedLists.size === 0) return;

    try {
      const selectedListEntries = (userLists || []).filter((list) => selectedLists.has(list.id));
      const promises = selectedListEntries.map((list) =>
        addToList.mutateAsync({
          listId: list.id,
          ownerPubkey: list.pubkey,
          videoCoordinate,
        }),
      );

      await Promise.all(promises);

      toast({
        title: t('addToListDialog.toastAddedTitle'),
        description: t('addToListDialog.toastAddedDescription', { count: selectedLists.size }),
      });

      // Invalidate queries to update the UI
      queryClient.invalidateQueries({ queryKey: ['videos-in-lists', videoId] });
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });

      onClose();
    } catch {
      toast({
        title: t('addToListDialog.toastAddFailedTitle'),
        description: t('addToListDialog.toastAddFailedDescription'),
        variant: 'destructive',
      });
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newListName.trim()) return;

    setIsCreating(true);
    try {
      const listId = newListName.toLowerCase().replace(/\s+/g, '-');

      await createList.mutateAsync({
        id: listId,
        name: newListName,
        description: newListDescription || undefined,
        videoCoordinates: [videoCoordinate]
      });

      toast({
        title: t('addToListDialog.toastCreatedTitle'),
        description: t('addToListDialog.toastCreatedDescription', { name: newListName }),
      });

      // Invalidate queries to update the UI
      queryClient.invalidateQueries({ queryKey: ['videos-in-lists', videoId] });
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });

      onClose();
    } catch {
      toast({
        title: t('addToListDialog.toastCreateFailedTitle'),
        description: t('addToListDialog.toastCreateFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) {
          onClose();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addToListDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('addToListDialog.loginRequiredDescription')}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addToListDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('addToListDialog.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Public lists containing this video */}
        <div className="space-y-2 mb-4">
          <h3 className="text-sm font-medium">{t('addToListDialog.includedInPublicLists')}</h3>
          {publicListsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (publicLists && publicLists.length > 0) ? (
            <div className="grid grid-cols-1 gap-2">
              {publicLists.slice(0, 6).map((list) => {
                const owner = list.pubkey;
                return (
                  <Link
                    to={`/list/${owner}/${encodeURIComponent(list.id)}`}
                    key={list.id + owner}
                    className="flex items-center justify-between rounded-md border p-2 hover:bg-accent"
                    onClick={() => onClose()}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{list.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t('addToListDialog.videoCount', { count: list.videoCoordinates.length })} • {format(new Date(list.createdAt * 1000), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('addToListDialog.notOnPublicLists')}</p>
          )}
        </div>

        <Tabs defaultValue="existing" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">{t('addToListDialog.tabYourLists')}</TabsTrigger>
            <TabsTrigger value="new">{t('addToListDialog.tabCreateNew')}</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4">
            {listsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : userLists && userLists.length > 0 ? (
              <>
                <ScrollArea className="h-64 w-full rounded-md border p-4">
                  <div className="space-y-2">
                    {userLists.map((list) => {
                      const isInList = list.videoCoordinates.includes(videoCoordinate);
                      return (
                        <div
                          key={list.id}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-accent"
                        >
                          <Checkbox
                            id={list.id}
                            checked={isInList || selectedLists.has(list.id)}
                            disabled={isInList}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedLists(new Set([...selectedLists, list.id]));
                              } else {
                                const newSet = new Set(selectedLists);
                                newSet.delete(list.id);
                                setSelectedLists(newSet);
                              }
                            }}
                          />
                          <Label
                            htmlFor={list.id}
                            className="flex-1 cursor-pointer flex items-center gap-2"
                          >
                            <List className="h-4 w-4" />
                            <span>{list.name}</span>
                            {isInList && (
                              <Check className="h-3 w-3 text-green-600 dark:text-green-400 ml-auto" />
                            )}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {t('addToListDialog.videoCount', { count: list.videoCoordinates.length })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <Button
                  onClick={handleAddToLists}
                  disabled={selectedLists.size === 0 || addToList.isPending}
                  className="w-full"
                >
                  {addToList.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {t('addToListDialog.addToCountButton', { count: selectedLists.size })}
                </Button>
              </>
            ) : (
              <div className="text-center py-8">
                <List className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  {t('addToListDialog.emptyState')}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const tabsList = document.querySelector('[value="new"]') as HTMLElement;
                    tabsList?.click();
                  }}
                >
                  {t('addToListDialog.createFirstList')}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">{t('addToListDialog.listNameLabel')}</Label>
              <Input
                id="list-name"
                placeholder={t('addToListDialog.listNamePlaceholder')}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="list-description">{t('addToListDialog.descriptionLabel')}</Label>
              <Textarea
                id="list-description"
                placeholder={t('addToListDialog.descriptionPlaceholder')}
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleCreateAndAdd}
              disabled={!newListName.trim() || isCreating}
              className="w-full"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {t('addToListDialog.createAndAddButton')}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
