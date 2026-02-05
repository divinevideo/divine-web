// ABOUTME: Dialog for confirming comment deletion
// ABOUTME: Allows user to optionally provide a reason for deletion

import { useState } from 'react';
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
import { AlertCircle } from 'lucide-react';
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
            Delete Comment?
          </DialogTitle>
          <DialogDescription>
            This action will send a deletion request to all relays. Most relays will honor this request and remove your comment.
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
              Reason (optional)
            </Label>
            <Textarea
              id="delete-reason"
              placeholder="Why are you deleting this comment?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isDeleting}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This reason will be included in the deletion event sent to relays.
            </p>
          </div>

          {/* Warning */}
          <div className="bg-brand-yellow-light border border-brand-yellow rounded-lg p-3 dark:bg-brand-yellow-dark">
            <p className="text-sm text-brand-yellow-dark dark:text-brand-yellow-light">
              <strong>Note:</strong> While most relays will remove your comment, deletion is not guaranteed. Some relays may choose to keep the content, and users who have already seen it will still have access.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Comment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
