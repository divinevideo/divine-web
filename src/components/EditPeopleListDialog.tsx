import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleNotch, FloppyDisk } from '@phosphor-icons/react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdatePeopleList } from '@/hooks/usePeopleListMutations';
import { useToast } from '@/hooks/useToast';
import { isValidOptionalUrl } from '@/lib/listFormUtils';
import type { PeopleList } from '@/lib/parsePeopleListFromEvent';

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
  const { t } = useTranslation();
  const { toast } = useToast();
  const updatePeopleList = useUpdatePeopleList();

  const listKey = `${list.pubkey}:${list.id}`;
  const [initializedListKey, setInitializedListKey] = useState<string | null>(null);
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? '');
  const [image, setImage] = useState(list.image ?? '');
  const [nameError, setNameError] = useState('');
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    if (!open) {
      setInitializedListKey(null);
      return;
    }

    if (initializedListKey === listKey) {
      return;
    }

    setName(list.name);
    setDescription(list.description ?? '');
    setImage(list.image ?? '');
    setNameError('');
    setImageError('');
    setInitializedListKey(listKey);
  }, [initializedListKey, list.description, list.image, list.name, listKey, open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNameError('');
    setImageError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t('editPeopleListDialog.nameRequired'));
      return;
    }

    if (!isValidOptionalUrl(image)) {
      setImageError(t('editPeopleListDialog.imageInvalid'));
      return;
    }

    try {
      // Empty strings clear the tag; undefined would leave the current value in place.
      await updatePeopleList.mutateAsync({
        listId: list.id,
        name: trimmedName,
        description: description.trim(),
        image: image.trim(),
      });

      toast({
        title: t('editPeopleListDialog.savedTitle'),
        description: t('editPeopleListDialog.savedDescription', { name: trimmedName }),
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t('editPeopleListDialog.failedTitle'),
        description: error instanceof Error ? error.message : t('editPeopleListDialog.failedDescription'),
        variant: 'destructive',
      });
    }
  };

  const isSaving = updatePeopleList.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editPeopleListDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('editPeopleListDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pr-2">
          <div className="space-y-2">
            <Label htmlFor="edit-people-list-name">{t('editPeopleListDialog.nameLabel')}</Label>
            <Input
              id="edit-people-list-name"
              placeholder={t('editPeopleListDialog.namePlaceholder')}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError('');
              }}
              disabled={isSaving}
              required
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'edit-people-list-name-error' : undefined}
            />
            {nameError && (
              <p id="edit-people-list-name-error" className="text-sm text-destructive" role="alert">
                {nameError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-people-list-description">{t('editPeopleListDialog.descriptionLabel')}</Label>
            <Textarea
              id="edit-people-list-description"
              placeholder={t('editPeopleListDialog.descriptionPlaceholder')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-people-list-image">{t('editPeopleListDialog.imageLabel')}</Label>
            <Input
              id="edit-people-list-image"
              type="url"
              placeholder={t('editPeopleListDialog.imagePlaceholder')}
              value={image}
              onChange={(event) => {
                setImage(event.target.value);
                if (imageError) setImageError('');
              }}
              disabled={isSaving}
              aria-invalid={Boolean(imageError)}
              aria-describedby={imageError ? 'edit-people-list-image-error' : undefined}
            />
            {imageError && (
              <p id="edit-people-list-image-error" className="text-sm text-destructive" role="alert">
                {imageError}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="flex-1"
            >
              {t('editPeopleListDialog.cancelButton')}
            </Button>
            <Button type="submit" variant="sticker" disabled={isSaving} className="flex-1">
              {isSaving ? (
                <>
                  <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                  {t('editPeopleListDialog.savingButton')}
                </>
              ) : (
                <>
                  <FloppyDisk className="mr-2 h-4 w-4" />
                  {t('editPeopleListDialog.saveButton')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
