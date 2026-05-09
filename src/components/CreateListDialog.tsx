// ABOUTME: Dialog component for creating new video lists
// ABOUTME: Allows users to create lists with name, description, and optional cover image

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateVideoList, type PlayOrder } from '@/hooks/useVideoLists';
import { useNavigate } from 'react-router-dom';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CircleNotch as Loader2, List, X } from '@phosphor-icons/react';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface CreateListDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateListDialog({ open, onClose }: CreateListDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const createList = useCreateVideoList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [playOrder, setPlayOrder] = useState<PlayOrder>('chronological');
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: t('createListDialog.toastNameRequiredTitle'),
        description: t('createListDialog.toastNameRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: t('createListDialog.toastLoginRequiredTitle'),
        description: t('createListDialog.toastLoginRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const listId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      await createList.mutateAsync({
        id: listId,
        name,
        description: description || undefined,
        image: imageUrl || undefined,
        videoCoordinates: [], // Start with empty list
        tags: tags.length > 0 ? tags : undefined,
        playOrder,
        isCollaborative
      });

      toast({
        title: t('createListDialog.toastCreatedTitle'),
        description: t('createListDialog.toastCreatedDescription', { name }),
      });

      // Navigate to the new list
      navigate(`/list/${user.pubkey}/${listId}`);
      onClose();
    } catch {
      toast({
        title: t('createListDialog.toastCreateFailedTitle'),
        description: t('createListDialog.toastCreateFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!isCreating && !newOpen) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createListDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('createListDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pr-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t('createListDialog.nameLabel')}</Label>
            <Input
              id="name"
              placeholder={t('createListDialog.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('createListDialog.descriptionLabel')}</Label>
            <Textarea
              id="description"
              placeholder={t('createListDialog.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">{t('createListDialog.imageLabel')}</Label>
            <Input
              id="image"
              type="url"
              placeholder={t('createListDialog.imagePlaceholder')}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={isCreating}
            />
            {imageUrl && (
              <div className="mt-2 rounded overflow-hidden border">
                <img
                  src={imageUrl}
                  alt={t('createListDialog.coverPreviewAlt')}
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="play-order">{t('createListDialog.playOrderLabel')}</Label>
            <Select value={playOrder} onValueChange={(value) => setPlayOrder(value as PlayOrder)} disabled={isCreating}>
              <SelectTrigger id="play-order">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chronological">{t('createListDialog.playOrderChronological')}</SelectItem>
                <SelectItem value="reverse">{t('createListDialog.playOrderReverse')}</SelectItem>
                <SelectItem value="manual">{t('createListDialog.playOrderManual')}</SelectItem>
                <SelectItem value="shuffle">{t('createListDialog.playOrderShuffle')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('createListDialog.playOrderHelp')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">{t('createListDialog.tagsLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder={t('createListDialog.tagsPlaceholder')}
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                disabled={isCreating}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!currentTag.trim() || isCreating}
              >
                {t('createListDialog.addTagButton')}
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive"
                      disabled={isCreating}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between space-x-2 pt-2">
            <div className="space-y-0.5">
              <Label htmlFor="collaborative">{t('createListDialog.collaborativeLabel')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('createListDialog.collaborativeHelp')}
              </p>
            </div>
            <Switch
              id="collaborative"
              checked={isCollaborative}
              onCheckedChange={setIsCollaborative}
              disabled={isCreating}
            />
          </div>

          <div className="flex gap-2 pt-4 sticky bottom-0 bg-background">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isCreating}
              className="flex-1"
            >
              {t('createListDialog.cancelButton')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('createListDialog.creatingButton')}
                </>
              ) : (
                <>
                  <List className="h-4 w-4 mr-2" />
                  {t('createListDialog.createButton')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}