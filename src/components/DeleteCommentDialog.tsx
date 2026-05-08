// ABOUTME: Dialog for confirming comment deletion
// ABOUTME: Allows user to optionally provide a reason for deletion

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { WarningCircle as AlertCircle } from '@phosphor-icons/react';
import type { NostrEvent } from '@nostrify/nostrify';

interface DeleteCommentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  comment: NostrEvent;
  isDeleting: boolean;
}

export function DeleteCommentDialog({
  open,
  onClose,
  onConfirm,
  comment,
  isDeleting,
}: DeleteCommentDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
  };

  const handleClose = () => {
    if (!isDeleting) {
      setReason('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {t('deleteCommentDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('deleteCommentDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Comment preview */}
          {comment.content && (
            <div className="rounded-lg border p-3 bg-brand-light-green dark:bg-brand-dark-green">
              <p className="text-sm line-clamp-3">{comment.content}</p>
            </div>
          )}

          {/* Optional reason */}
          <div className="space-y-2">
            <Label htmlFor="delete-reason">
              {t('deleteCommentDialog.reasonLabel')}
            </Label>
            <Textarea
              id="delete-reason"
              placeholder={t('deleteCommentDialog.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isDeleting}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t('deleteCommentDialog.reasonHelp')}
            </p>
          </div>

          {/* Warning */}
          <div className="bg-brand-yellow-light border border-brand-yellow rounded-lg p-3 dark:bg-brand-yellow-dark">
            <p className="text-sm text-brand-yellow-dark dark:text-brand-yellow-light">
              <strong>{t('deleteCommentDialog.noteLabel')}</strong> {t('deleteCommentDialog.noteBody')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            {t('deleteCommentDialog.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? t('deleteCommentDialog.deleting') : t('deleteCommentDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
