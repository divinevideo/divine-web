// ABOUTME: Dialog for confirming people list deletion
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
import { useDeletePeopleList } from '@/hooks/useDeletePeopleList';
import { useToast } from '@/hooks/useToast';
import type { PeopleList } from '@/types/peopleList';

interface DeletePeopleListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: PeopleList;
  onDeleted?: () => void;
}

export function DeletePeopleListDialog({
  open,
  onOpenChange,
  list,
  onDeleted,
}: DeletePeopleListDialogProps) {
  const { mutateAsync, isPending } = useDeletePeopleList();
  const { toast } = useToast();

  const handleClose = () => {
    if (!isPending) {
      onOpenChange(false);
    }
  };

  const handleConfirm = async () => {
    try {
      await mutateAsync({ listId: list.id });
      onOpenChange(false);
      onDeleted?.();
      toast({
        title: 'List deleted.',
        description: 'Your people list has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Delete failed.',
        description: error instanceof Error ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Delete "{list.name}"?
          </DialogTitle>
          <DialogDescription>
            Delete "{list.name}"? This can't be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? (
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
