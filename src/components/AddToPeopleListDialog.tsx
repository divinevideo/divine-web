// ABOUTME: Dialog for quickly adding/removing a person from the current user's people lists
// ABOUTME: Checkbox rows give instant per-list toggle; footer opens CreatePeopleListDialog

import { useState } from 'react';
import { usePeopleLists } from '@/hooks/usePeopleLists';
import {
  useAddToPeopleList,
  useRemoveFromPeopleList,
} from '@/hooks/usePeopleListMutations';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Users } from '@phosphor-icons/react';
import { CreatePeopleListDialog } from '@/components/CreatePeopleListDialog';

interface AddToPeopleListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberPubkey: string;
}

export function AddToPeopleListDialog({
  open,
  onOpenChange,
  memberPubkey,
}: AddToPeopleListDialogProps) {
  const { user } = useCurrentUser();
  const { data: userLists, isLoading } = usePeopleLists(user?.pubkey);
  const addToList = useAddToPeopleList();
  const removeFromList = useRemoveFromPeopleList();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleToggle = async (listId: string, currentlyChecked: boolean) => {
    if (currentlyChecked) {
      await removeFromList.mutateAsync({ listId, memberPubkey });
    } else {
      await addToList.mutateAsync({ listId, memberPubkey });
    }
  };

  const isEmpty = !isLoading && (!userLists || userLists.length === 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add to a list</DialogTitle>
            <DialogDescription>
              Pick which of your people lists to add this person to.
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="space-y-2 py-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {!isLoading && !isEmpty && (
            <ScrollArea className="max-h-64 w-full rounded-md border p-4">
              <div className="space-y-2">
                {userLists!.map((list) => {
                  const isChecked = list.members.includes(memberPubkey);
                  return (
                    <div
                      key={list.id}
                      className="flex items-center space-x-3 p-2 rounded hover:bg-accent"
                    >
                      <Checkbox
                        id={list.id}
                        checked={isChecked}
                        onCheckedChange={() => handleToggle(list.id, isChecked)}
                      />
                      <Label
                        htmlFor={list.id}
                        className="flex-1 cursor-pointer flex items-center gap-2"
                      >
                        <Users className="h-4 w-4 shrink-0" />
                        <span className="truncate">{list.name}</span>
                      </Label>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {list.members.length} {list.members.length === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {isEmpty && (
            <p className="text-sm text-muted-foreground text-center py-4">
              You don't have any lists yet.
            </p>
          )}

          <div className="pt-2">
            <Button
              variant="sticker"
              className="w-full"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new list
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreatePeopleListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        prefilledMembers={[memberPubkey]}
      />
    </>
  );
}
