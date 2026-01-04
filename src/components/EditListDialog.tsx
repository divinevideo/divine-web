// ABOUTME: Dialog component for editing existing video lists
// ABOUTME: Allows users to modify list metadata including name, description, cover image, and settings

import { useState, useEffect } from 'react';
import { useCreateVideoList, type PlayOrder, type VideoList } from '@/hooks/useVideoLists';
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
import { Loader2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface EditListDialogProps {
  open: boolean;
  onClose: () => void;
  list: VideoList;
}

export function EditListDialog({ open, onClose, list }: EditListDialogProps) {
  const { toast } = useToast();
  const updateList = useCreateVideoList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [playOrder, setPlayOrder] = useState<PlayOrder>('chronological');
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form fields when list prop changes
  useEffect(() => {
    if (list) {
      setName(list.name || '');
      setDescription(list.description || '');
      setImageUrl(list.image || '');
      setPlayOrder(list.playOrder || 'chronological');
      setIsCollaborative(list.isCollaborative || false);
      setTags(list.tags || []);
      setCurrentTag('');
    }
  }, [list]);

  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a list name',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateList.mutateAsync({
        id: list.id,
        name,
        description: description || undefined,
        image: imageUrl || undefined,
        videoCoordinates: list.videoCoordinates, // Preserve existing videos
        tags: tags.length > 0 ? tags : undefined,
        playOrder,
        isCollaborative,
        allowedCollaborators: list.allowedCollaborators,
        thumbnailEventId: list.thumbnailEventId,
      });

      toast({
        title: 'List updated',
        description: `"${name}" has been updated successfully`,
      });

      onClose();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update list. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!isSaving && !newOpen) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit List</DialogTitle>
          <DialogDescription>
            Update your list's details and settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pr-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">List Name *</Label>
            <Input
              id="edit-name"
              placeholder="My Favorite Vines"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              placeholder="A collection of hilarious and creative videos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-image">Cover Image URL</Label>
            <Input
              id="edit-image"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={isSaving}
            />
            {imageUrl && (
              <div className="mt-2 rounded overflow-hidden border">
                <img
                  src={imageUrl}
                  alt="Cover preview"
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-play-order">Play Order</Label>
            <Select value={playOrder} onValueChange={(value) => setPlayOrder(value as PlayOrder)} disabled={isSaving}>
              <SelectTrigger id="edit-play-order">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chronological">Chronological (oldest first)</SelectItem>
                <SelectItem value="reverse">Reverse (newest first)</SelectItem>
                <SelectItem value="manual">Manual (custom order)</SelectItem>
                <SelectItem value="shuffle">Shuffle (random order)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How videos should be ordered when viewing the list
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-tags">Tags (for discovery)</Label>
            <div className="flex gap-2">
              <Input
                id="edit-tags"
                placeholder="comedy, funny, animals..."
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                disabled={isSaving}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!currentTag.trim() || isSaving}
              >
                Add
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
                      disabled={isSaving}
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
              <Label htmlFor="edit-collaborative">Collaborative List</Label>
              <p className="text-xs text-muted-foreground">
                Allow others to add videos to this list
              </p>
            </div>
            <Switch
              id="edit-collaborative"
              checked={isCollaborative}
              onCheckedChange={setIsCollaborative}
              disabled={isSaving}
            />
          </div>

          <div className="flex gap-2 pt-4 sticky bottom-0 bg-background">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
