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
import { AlertCircle, Loader2 } from 'lucide-react';

interface DeleteListDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  listName: string;
  isDeleting: boolean;
}

export function DeleteListDialog({
  open,
  onClose,
  onConfirm,
  listName,
  isDeleting,
}: DeleteListDialogProps) {
  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Delete List?
          </DialogTitle>
          <DialogDescription>
            This will permanently delete the list "{listName}". Videos in the list will not be affected.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-brand-yellow-light border border-brand-yellow rounded-lg p-3 dark:bg-brand-yellow-dark">
            <p className="text-sm text-brand-yellow-dark dark:text-brand-yellow-light">
              <strong>Note:</strong> This action sends a deletion request to relays. Most relays will honor this request, but deletion is not guaranteed on all relays.
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
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete List'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
