// ABOUTME: Dialog component for editing an existing people list (NIP-51 kind 30000)
// ABOUTME: Pre-populates name/description/image from the list; calls useUpdatePeopleList on save

import { useEffect, useState } from 'react';
import { useUpdatePeopleList } from '@/hooks/useUpdatePeopleList';
import type { PeopleList } from '@/types/peopleList';
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
import { CircleNotch, FloppyDisk } from '@phosphor-icons/react';
import { useToast } from '@/hooks/useToast';

interface EditPeopleListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: PeopleList;
}

export function EditPeopleListDialog({
  open,
  onOpenChange,
  list,
}: EditPeopleListDialogProps) {
  const { toast } = useToast();
  const updatePeopleList = useUpdatePeopleList();

  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? '');
  const [image, setImage] = useState(list.image ?? '');
  const [nameError, setNameError] = useState('');
  const [imageError, setImageError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form to current list values whenever the dialog opens
  useEffect(() => {
    if (open) {
      setName(list.name);
      setDescription(list.description ?? '');
      setImage(list.image ?? '');
      setNameError('');
      setImageError('');
    }
  }, [open, list]);

  const validateImage = (url: string): boolean => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset errors
    setNameError('');
    setImageError('');

    // Validate name
    if (!name.trim()) {
      setNameError('Name is required.');
      return;
    }

    // Validate image URL if provided
    if (image && !validateImage(image)) {
      setImageError('Enter a valid URL (e.g. https://example.com/image.jpg).');
      return;
    }

    setIsSubmitting(true);
    try {
      await updatePeopleList.mutateAsync({
        listId: list.id,
        name: name.trim(),
        description,
        image,
      });

      toast({
        title: 'Saved. Looking sharp.',
      });

      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Try again?';
      toast({
        title: 'Didn\'t save.',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!isSubmitting) {
      onOpenChange(next);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit list</DialogTitle>
          <DialogDescription>
            Update the name, description, or cover image for this list.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pr-2">
          <div className="space-y-2">
            <Label htmlFor="edit-people-list-name">List name *</Label>
            <Input
              id="edit-people-list-name"
              placeholder="My favorites"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              disabled={isSubmitting}
              aria-describedby={nameError ? 'edit-people-list-name-error' : undefined}
            />
            {nameError && (
              <p
                id="edit-people-list-name-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {nameError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-people-list-description">Description</Label>
            <Textarea
              id="edit-people-list-description"
              placeholder="What's this list for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-people-list-image">Cover image URL</Label>
            <Input
              id="edit-people-list-image"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={image}
              onChange={(e) => {
                setImage(e.target.value);
                if (imageError) setImageError('');
              }}
              disabled={isSubmitting}
              aria-describedby={imageError ? 'edit-people-list-image-error' : undefined}
            />
            {imageError && (
              <p
                id="edit-people-list-image-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {imageError}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4 sticky bottom-0 bg-background">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="sticker"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FloppyDisk className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
