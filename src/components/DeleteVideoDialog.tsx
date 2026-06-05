// ABOUTME: Dialog for confirming video deletion
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
import type { ParsedVideoData } from '@/types/video';

interface DeleteVideoDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  video: ParsedVideoData;
  isDeleting: boolean;
}

export function DeleteVideoDialog({
  open,
  onClose,
  onConfirm,
  video,
  isDeleting,
}: DeleteVideoDialogProps) {
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
            {t('deleteVideoDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('deleteVideoDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Video preview */}
          {video.title && (
            <div className="rounded-lg border p-3 bg-brand-light-green dark:bg-brand-dark-green">
              <p className="font-medium text-sm">{video.title}</p>
              {video.content && video.content !== video.title && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {video.content}
                </p>
              )}
            </div>
          )}

          {/* Optional reason */}
          <div className="space-y-2">
            <Label htmlFor="delete-reason">
              {t('deleteVideoDialog.reasonLabel')}
            </Label>
            <Textarea
              id="delete-reason"
              placeholder={t('deleteVideoDialog.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isDeleting}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t('deleteVideoDialog.reasonHelp')}
            </p>
          </div>

          {/* Warning */}
          <div className="bg-brand-yellow-light border border-brand-yellow rounded-lg p-3 dark:bg-brand-yellow-dark">
            <p className="text-sm text-brand-yellow-dark dark:text-brand-yellow-light">
              <strong>{t('deleteVideoDialog.noteLabel')}</strong> {t('deleteVideoDialog.noteBody')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            {t('deleteVideoDialog.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? t('deleteVideoDialog.deleting') : t('deleteVideoDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
