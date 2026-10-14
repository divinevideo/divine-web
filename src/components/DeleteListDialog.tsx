// ABOUTME: Dialog for confirming list deletion
// ABOUTME: Shows list name and warns about permanent deletion

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WarningCircle as AlertCircle, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

type DeleteListKind = 'video' | 'people';

interface DeleteListDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  listName: string;
  isDeleting: boolean;
  listKind?: DeleteListKind;
}

export function DeleteListDialog({
  open,
  onClose,
  onConfirm,
  listName,
  isDeleting,
  listKind = 'video',
}: DeleteListDialogProps) {
  const { t } = useTranslation();
  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  const itemKey = listKind === 'people' ? 'people' : 'videos';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {t('deleteListDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t(`deleteListDialog.${itemKey}Description`, { name: listName })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-brand-yellow-light border border-brand-yellow rounded-lg p-3 dark:bg-brand-yellow-dark">
            <p className="text-sm text-brand-yellow-dark dark:text-brand-yellow-light">
              <strong>{t('deleteListDialog.noteLabel')}</strong>{' '}
              {t('deleteListDialog.relayNote')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            {t('deleteListDialog.cancelButton')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('deleteListDialog.deletingButton')}
              </>
            ) : (
              t('deleteListDialog.deleteButton')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
