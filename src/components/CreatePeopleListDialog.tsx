import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CircleNotch, UsersThree } from '@phosphor-icons/react';

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
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCreatePeopleList } from '@/hooks/usePeopleListMutations';
import { useToast } from '@/hooks/useToast';
import { buildPeopleListPath } from '@/lib/eventRouting';
import { isValidOptionalUrl, slugifyListName } from '@/lib/listFormUtils';
import { isReservedListDTag } from '@/lib/parsePeopleListFromEvent';

interface CreatePeopleListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledMembers?: string[];
}

export function CreatePeopleListDialog({
  open,
  onOpenChange,
  prefilledMembers = [],
}: CreatePeopleListDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const createPeopleList = useCreatePeopleList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [nameError, setNameError] = useState('');
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setImage('');
      setNameError('');
      setImageError('');
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNameError('');
    setImageError('');

    const trimmedName = name.trim();
    const listId = slugifyListName(trimmedName);

    if (!trimmedName || !listId) {
      setNameError(t('createPeopleListDialog.nameRequired'));
      return;
    }

    if (isReservedListDTag(listId)) {
      setNameError(t('createPeopleListDialog.reservedName'));
      return;
    }

    if (!isValidOptionalUrl(image)) {
      setImageError(t('createPeopleListDialog.imageInvalid'));
      return;
    }

    try {
      await createPeopleList.mutateAsync({
        id: listId,
        name: trimmedName,
        description: description.trim() || undefined,
        image: image.trim() || undefined,
        memberPubkeys: prefilledMembers,
      });

      toast({
        title: t('createPeopleListDialog.createdTitle'),
        description: t('createPeopleListDialog.createdDescription', { name: trimmedName }),
      });
      onOpenChange(false);
      if (user) navigate(buildPeopleListPath(user.pubkey, listId));
    } catch (error) {
      toast({
        title: t('createPeopleListDialog.failedTitle'),
        description: error instanceof Error ? error.message : t('createPeopleListDialog.failedDescription'),
        variant: 'destructive',
      });
    }
  };

  const isCreating = createPeopleList.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isCreating) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createPeopleListDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('createPeopleListDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pr-2">
          <div className="space-y-2">
            <Label htmlFor="create-people-list-name">{t('createPeopleListDialog.nameLabel')}</Label>
            <Input
              id="create-people-list-name"
              placeholder={t('createPeopleListDialog.namePlaceholder')}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError('');
              }}
              disabled={isCreating}
              aria-describedby={nameError ? 'create-people-list-name-error' : undefined}
            />
            {nameError && (
              <p id="create-people-list-name-error" className="text-sm text-destructive" role="alert">
                {nameError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-people-list-description">{t('createPeopleListDialog.descriptionLabel')}</Label>
            <Textarea
              id="create-people-list-description"
              placeholder={t('createPeopleListDialog.descriptionPlaceholder')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-people-list-image">{t('createPeopleListDialog.imageLabel')}</Label>
            <Input
              id="create-people-list-image"
              type="url"
              placeholder={t('createPeopleListDialog.imagePlaceholder')}
              value={image}
              onChange={(event) => {
                setImage(event.target.value);
                if (imageError) setImageError('');
              }}
              disabled={isCreating}
              aria-describedby={imageError ? 'create-people-list-image-error' : undefined}
            />
            {imageError && (
              <p id="create-people-list-image-error" className="text-sm text-destructive" role="alert">
                {imageError}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
              className="flex-1"
            >
              {t('createPeopleListDialog.cancelButton')}
            </Button>
            <Button type="submit" variant="sticker" disabled={isCreating} className="flex-1">
              {isCreating ? (
                <>
                  <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                  {t('createPeopleListDialog.creatingButton')}
                </>
              ) : (
                <>
                  <UsersThree className="mr-2 h-4 w-4" />
                  {t('createPeopleListDialog.createButton')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
