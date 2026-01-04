# Lists CRUD Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the lists CRUD functionality by adding edit, delete, and discover features.

**Architecture:** Reuse existing patterns from CreateListDialog for EditListDialog. Add useDeleteVideoList hook following the same pattern as useRemoveVideoFromList. Discover tab queries lists from followed users using useFollowList.

**Tech Stack:** React, TanStack Query, Nostr (NIP-51 kind 30005), shadcn/ui components

---

## Task 1: Add useDeleteVideoList Hook

**Files:**
- Modify: `src/hooks/useVideoLists.ts` (add new hook at end of file)

**Step 1: Add the delete hook**

Add this after `useTrendingVideoLists` (around line 509):

```typescript
/**
 * Hook to delete a video list (publishes deletion event)
 */
export function useDeleteVideoList() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId }: { listId: string }) => {
      if (!user) throw new Error('Must be logged in to delete lists');

      // Publish a kind 5 deletion event targeting the list
      // The 'a' tag references the addressable event to delete
      await publishEvent({
        kind: 5, // NIP-09 deletion event
        content: 'List deleted by owner',
        tags: [
          ['a', `30005:${user.pubkey}:${listId}`],
        ]
      });

      return { listId };
    },
    onSuccess: ({ listId }) => {
      // Remove from cache immediately
      if (user) {
        queryClient.setQueryData<VideoList[]>(
          ['video-lists', user.pubkey],
          (oldLists) => oldLists?.filter(l => l.id !== listId) || []
        );
      }
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });
      queryClient.invalidateQueries({ queryKey: ['trending-video-lists'] });
      queryClient.invalidateQueries({ queryKey: ['followed-users-lists'] });
    }
  });
}
```

**Step 2: Export the new hook**

The hook is already exported via `export function`. No additional export needed.

**Step 3: Commit**

```bash
git add src/hooks/useVideoLists.ts
git commit -m "feat(lists): add useDeleteVideoList hook for NIP-09 deletion"
```

---

## Task 2: Add useFollowedUsersLists Hook

**Files:**
- Modify: `src/hooks/useVideoLists.ts` (add new hook)

**Step 1: Add hook after useDeleteVideoList**

```typescript
/**
 * Hook to fetch lists from users the current user follows
 */
export function useFollowedUsersLists(followedPubkeys: string[] | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['followed-users-lists', followedPubkeys?.slice(0, 50)],
    queryFn: async (context) => {
      if (!followedPubkeys || followedPubkeys.length === 0) return [];

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(8000)
      ]);

      // Query lists from followed users (limit to first 50 to avoid huge queries)
      const pubkeysToQuery = followedPubkeys.slice(0, 50);

      const events = await nostr.query([{
        kinds: [30005],
        authors: pubkeysToQuery,
        limit: 100
      }], { signal });

      const lists = events
        .map(parseVideoList)
        .filter((list): list is VideoList => list !== null && list.videoCoordinates.length > 0)
        .sort((a, b) => b.createdAt - a.createdAt);

      return lists;
    },
    enabled: !!followedPubkeys && followedPubkeys.length > 0,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });
}
```

**Step 2: Commit**

```bash
git add src/hooks/useVideoLists.ts
git commit -m "feat(lists): add useFollowedUsersLists hook for discover tab"
```

---

## Task 3: Create DeleteListDialog Component

**Files:**
- Create: `src/components/DeleteListDialog.tsx`

**Step 1: Create the dialog component**

```typescript
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
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-3">
            <p className="text-sm text-yellow-900 dark:text-yellow-200">
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
```

**Step 2: Commit**

```bash
git add src/components/DeleteListDialog.tsx
git commit -m "feat(lists): add DeleteListDialog component"
```

---

## Task 4: Create EditListDialog Component

**Files:**
- Create: `src/components/EditListDialog.tsx`

**Step 1: Create the edit dialog (based on CreateListDialog)**

```typescript
// ABOUTME: Dialog component for editing existing video lists
// ABOUTME: Allows users to update list name, description, cover image, and settings

import { useState, useEffect } from 'react';
import { useCreateVideoList, type PlayOrder, type VideoList } from '@/hooks/useVideoLists';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface EditListDialogProps {
  open: boolean;
  onClose: () => void;
  list: VideoList;
}

export function EditListDialog({ open, onClose, list }: EditListDialogProps) {
  const { toast } = useToast();
  const updateList = useCreateVideoList(); // Same hook works for updates (replaceable events)

  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description || '');
  const [imageUrl, setImageUrl] = useState(list.image || '');
  const [playOrder, setPlayOrder] = useState<PlayOrder>(list.playOrder || 'chronological');
  const [isCollaborative, setIsCollaborative] = useState(list.isCollaborative || false);
  const [tags, setTags] = useState<string[]>(list.tags || []);
  const [currentTag, setCurrentTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when list changes
  useEffect(() => {
    setName(list.name);
    setDescription(list.description || '');
    setImageUrl(list.image || '');
    setPlayOrder(list.playOrder || 'chronological');
    setIsCollaborative(list.isCollaborative || false);
    setTags(list.tags || []);
  }, [list]);

  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a list name',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateList.mutateAsync({
        id: list.id, // Keep the same ID to update
        name,
        description: description || undefined,
        image: imageUrl || undefined,
        videoCoordinates: list.videoCoordinates, // Preserve existing videos
        tags: tags.length > 0 ? tags : undefined,
        playOrder,
        isCollaborative
      });

      toast({
        title: 'List updated',
        description: `"${name}" has been updated successfully`,
      });

      onClose();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update list. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!isSaving && !newOpen) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit List</DialogTitle>
          <DialogDescription>
            Update your list settings and metadata
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pr-2">
          <div className="space-y-2">
            <Label htmlFor="name">List Name *</Label>
            <Input
              id="name"
              placeholder="My Favorite Vines"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A collection of hilarious and creative videos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Cover Image URL</Label>
            <Input
              id="image"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={isSaving}
            />
            {imageUrl && (
              <div className="mt-2 rounded overflow-hidden border">
                <img
                  src={imageUrl}
                  alt="Cover preview"
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="play-order">Play Order</Label>
            <Select value={playOrder} onValueChange={(value) => setPlayOrder(value as PlayOrder)} disabled={isSaving}>
              <SelectTrigger id="play-order">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chronological">Chronological (oldest first)</SelectItem>
                <SelectItem value="reverse">Reverse (newest first)</SelectItem>
                <SelectItem value="manual">Manual (custom order)</SelectItem>
                <SelectItem value="shuffle">Shuffle (random order)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (for discovery)</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder="comedy, funny, animals..."
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                disabled={isSaving}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!currentTag.trim() || isSaving}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive"
                      disabled={isSaving}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between space-x-2 pt-2">
            <div className="space-y-0.5">
              <Label htmlFor="collaborative">Collaborative List</Label>
              <p className="text-xs text-muted-foreground">
                Allow others to add videos to this list
              </p>
            </div>
            <Switch
              id="collaborative"
              checked={isCollaborative}
              onCheckedChange={setIsCollaborative}
              disabled={isSaving}
            />
          </div>

          <div className="flex gap-2 pt-4 sticky bottom-0 bg-background">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/EditListDialog.tsx
git commit -m "feat(lists): add EditListDialog component for editing list metadata"
```

---

## Task 5: Wire Up Edit and Delete in ListDetailPage

**Files:**
- Modify: `src/pages/ListDetailPage.tsx`

**Step 1: Add imports at top of file (after line 25)**

Add these imports:

```typescript
import { useDeleteVideoList } from '@/hooks/useVideoLists';
import { EditListDialog } from '@/components/EditListDialog';
import { DeleteListDialog } from '@/components/DeleteListDialog';
```

**Step 2: Add state and hooks inside component (after line 219)**

After `const removeVideo = useRemoveVideoFromList();` add:

```typescript
  const deleteList = useDeleteVideoList();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteList = async () => {
    if (!list) return;
    setIsDeleting(true);
    try {
      await deleteList.mutateAsync({ listId: list.id });
      toast({
        title: 'List deleted',
        description: `"${list.name}" has been deleted`,
      });
      navigate('/lists');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete list',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };
```

**Step 3: Add useState import**

Update the React import at line 4 to include useState:

```typescript
import { useState } from 'react';
```

Wait, looking at the file, it doesn't have useState imported. Need to add it. Actually, looking again, it doesn't use useState currently. We need to add it.

**Step 4: Update the Edit button (around line 435)**

Replace:
```typescript
                {isOwner && (
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit List
                  </Button>
                )}
```

With:
```typescript
                {isOwner && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit List
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
```

**Step 5: Add dialogs before closing div (before line 543)**

Add before the final `</div>`:

```typescript
      {/* Edit List Dialog */}
      {list && showEditDialog && (
        <EditListDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          list={list}
        />
      )}

      {/* Delete List Dialog */}
      {list && showDeleteDialog && (
        <DeleteListDialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteList}
          listName={list.name}
          isDeleting={isDeleting}
        />
      )}
```

**Step 6: Commit**

```bash
git add src/pages/ListDetailPage.tsx
git commit -m "feat(lists): wire up edit and delete functionality in list detail page"
```

---

## Task 6: Implement Discover Tab in ListsPage

**Files:**
- Modify: `src/pages/ListsPage.tsx`

**Step 1: Add imports (update line 5)**

Update imports to include new hooks:

```typescript
import { useVideoLists, useTrendingVideoLists, useFollowedUsersLists } from '@/hooks/useVideoLists';
import { useFollowList } from '@/hooks/useFollowList';
```

**Step 2: Add hooks inside component (after line 106)**

After `const [showCreateDialog, setShowCreateDialog] = useState(false);` add:

```typescript
  const { data: followedPubkeys } = useFollowList();
  const { data: followedUsersLists, isLoading: discoverLoading } = useFollowedUsersLists(followedPubkeys);
```

**Step 3: Replace Discover tab content (lines 228-239)**

Replace the existing TabsContent for "discover":

```typescript
        {/* Discover Tab */}
        <TabsContent value="discover" className="space-y-6">
          {!user ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Log in to discover lists from people you follow
                </p>
              </CardContent>
            </Card>
          ) : discoverLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : followedUsersLists && followedUsersLists.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Lists from people you follow</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {followedUsersLists.map((list) => (
                  <ListCard key={`${list.pubkey}-${list.id}`} list={list} />
                ))}
              </div>
            </>
          ) : followedPubkeys && followedPubkeys.length > 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No lists found from people you follow
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Check back later or explore trending lists
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Follow some creators to see their lists here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
```

**Step 4: Commit**

```bash
git add src/pages/ListsPage.tsx
git commit -m "feat(lists): implement discover tab with lists from followed users"
```

---

## Task 7: Final Testing and Verification

**Step 1: Run type check**

```bash
cd /Users/rabble/code/andotherstuff/divine-web && npm run typecheck
```

Expected: No type errors

**Step 2: Run dev server and test manually**

```bash
npm run dev
```

Test checklist:
- [ ] Navigate to /lists
- [ ] Create a new list
- [ ] Navigate to list detail page
- [ ] Click "Edit List" button - should open dialog
- [ ] Update list name and save
- [ ] Click "Delete" button - should open confirmation
- [ ] Delete the list - should navigate back to /lists
- [ ] Check "Discover" tab - should show lists from followed users (if following anyone)

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(lists): complete CRUD functionality with edit, delete, and discover"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | useDeleteVideoList hook | useVideoLists.ts |
| 2 | useFollowedUsersLists hook | useVideoLists.ts |
| 3 | DeleteListDialog component | DeleteListDialog.tsx |
| 4 | EditListDialog component | EditListDialog.tsx |
| 5 | Wire up ListDetailPage | ListDetailPage.tsx |
| 6 | Implement Discover tab | ListsPage.tsx |
| 7 | Testing and verification | - |
