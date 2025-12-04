// ABOUTME: Warning dialog to prevent accidental follow list overwrites
// ABOUTME: Shown to users from other clients who have no follow list on Rewind

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface FollowListSafetyDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  targetUserName?: string;
}

export function FollowListSafetyDialog({
  open,
  onConfirm,
  onCancel,
  targetUserName,
}: FollowListSafetyDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-xl">
              Follow List Safety Check
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base leading-relaxed space-y-3 pt-2">
            <p>
              It looks like you're using a Nostr account from another client.
            </p>
            <p>
              <strong className="text-foreground">Important:</strong> We couldn't find your follow list on rewind's relays. 
              If you follow {targetUserName || 'this user'}, it may create a new contact list that could 
              overwrite your existing follows from other clients.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Recommendation:</strong> Before following anyone on Rewind, consider publishing your 
              existing follow list to rewind's relays using your other Nostr client. This ensures your 
              follows are synchronized across all apps.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCancel} className="sm:order-1">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800 sm:order-2"
          >
            I Understand, Follow Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
