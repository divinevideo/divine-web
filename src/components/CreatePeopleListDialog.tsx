// ABOUTME: Dialog component for creating new people lists (NIP-51 kind 30000)
// ABOUTME: Three fields: name (required), description (optional), image URL (optional)

import { useState } from 'react';
import { useCreatePeopleList } from '@/hooks/useCreatePeopleList';
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
import { CircleNotch, Users } from '@phosphor-icons/react';
import { useToast } from '@/hooks/useToast';

interface CreatePeopleListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledMembers?: string[];
}

export function CreatePeopleListDialog({
  open,
  onOpenChange,
  prefilledMembers,
}: CreatePeopleListDialogProps) {
  const { toast } = useToast();
  const createPeopleList = useCreatePeopleList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [nameError, setNameError] = useState('');
  const [imageError, setImageError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await createPeopleList.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        image: image.trim() || undefined,
        members: prefilledMembers ?? [],
      });

      toast({
        title: 'List created.',
        description: 'Now add some loopers.',
      });

      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Try again?';
      toast({
        title: 'Didn\'t make it.',
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
          <DialogTitle>Create a people list</DialogTitle>
          <DialogDescription>
            Curate a list of loopers to follow, share, or revisit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pr-2">
          <div className="space-y-2">
            <Label htmlFor="people-list-name">List name *</Label>
            <Input
              id="people-list-name"
              placeholder="My favorites"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              disabled={isSubmitting}
              aria-describedby={nameError ? 'people-list-name-error' : undefined}
            />
            {nameError && (
              <p
                id="people-list-name-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {nameError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="people-list-description">Description</Label>
            <Textarea
              id="people-list-description"
              placeholder="What's this list for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="people-list-image">Cover image URL</Label>
            <Input
              id="people-list-image"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={image}
              onChange={(e) => {
                setImage(e.target.value);
                if (imageError) setImageError('');
              }}
              disabled={isSubmitting}
              aria-describedby={imageError ? 'people-list-image-error' : undefined}
            />
            {imageError && (
              <p
                id="people-list-image-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {imageError}
              </p>
            )}
          </div>

          {prefilledMembers && prefilledMembers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Will include {prefilledMembers.length}{' '}
              {prefilledMembers.length === 1 ? 'person' : 'people'}.
            </p>
          )}

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
                  Creating...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Create list
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
