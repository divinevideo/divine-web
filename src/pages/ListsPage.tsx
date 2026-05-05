// ABOUTME: Page component for browsing and managing both video lists and people lists
// ABOUTME: Two sub-tabs: Authored (user's own lists) and Saved (resolved saved-list references)

import { useState } from 'react';
import { useUnifiedLists } from '@/hooks/useUnifiedLists';
import { useResolvedSavedLists } from '@/hooks/useResolvedSavedLists';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { List, BookmarkSimple } from '@phosphor-icons/react';
import { CreatePeopleListDialog } from '@/components/CreatePeopleListDialog';
import { UnifiedListCard } from '@/components/UnifiedListCard';
import type { PeopleList } from '@/types/peopleList';
import type { VideoList } from '@/hooks/useVideoLists';

// Unified display item — carries the kind tag for polymorphic dispatch
type UnifiedItem =
  | { kind: 30000; list: PeopleList; createdAt: number }
  | { kind: 30005; list: VideoList; createdAt: number };

function flattenAndSort(people: PeopleList[], video: VideoList[]): UnifiedItem[] {
  const items: UnifiedItem[] = [
    ...people.map((list): UnifiedItem => ({ kind: 30000, list, createdAt: list.createdAt })),
    ...video.map((list): UnifiedItem => ({ kind: 30005, list, createdAt: list.createdAt })),
  ];
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-4">
            <Skeleton className="h-[120px] w-full rounded-lg mb-2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2 mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ListsPage() {
  const { user } = useCurrentUser();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const authored = useUnifiedLists(user?.pubkey);
  const saved = useResolvedSavedLists();

  const authoredItems = flattenAndSort(authored.people, authored.video);
  const savedItems = flattenAndSort(saved.people, saved.video);

  const CreateCTA = (
    <Button variant="sticker" onClick={() => setShowCreateDialog(true)}>
      <List className="h-4 w-4 mr-2" />
      + Create new list
    </Button>
  );

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <List className="h-8 w-8" />
            Lists
          </h1>
          {user && CreateCTA}
        </div>
        <p className="text-muted-foreground">
          Your curated collections of videos and people.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="authored" className="space-y-6">
        <TabsList>
          <TabsTrigger value="authored">
            <List className="h-4 w-4 mr-2" />
            Authored
          </TabsTrigger>
          <TabsTrigger value="saved">
            <BookmarkSimple className="h-4 w-4 mr-2" />
            Saved
          </TabsTrigger>
        </TabsList>

        {/* Authored Tab */}
        <TabsContent value="authored" className="space-y-6">
          {authored.isLoading ? (
            <SkeletonGrid />
          ) : authoredItems.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {authoredItems.map((item) =>
                item.kind === 30000 ? (
                  <UnifiedListCard
                    key={`people-${item.list.pubkey}-${item.list.id}`}
                    kind={30000}
                    list={item.list}
                  />
                ) : (
                  <UnifiedListCard
                    key={`video-${item.list.pubkey}-${item.list.id}`}
                    kind={30005}
                    list={item.list}
                  />
                )
              )}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center space-y-4">
                <List className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">No lists yet. Create your first.</p>
                {user && (
                  <Button variant="sticker" onClick={() => setShowCreateDialog(true)}>
                    <List className="h-4 w-4 mr-2" />
                    + Create new list
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Saved Tab */}
        <TabsContent value="saved" className="space-y-6">
          {saved.isLoading ? (
            <SkeletonGrid />
          ) : savedItems.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {savedItems.map((item) =>
                item.kind === 30000 ? (
                  <UnifiedListCard
                    key={`people-${item.list.pubkey}-${item.list.id}`}
                    kind={30000}
                    list={item.list}
                  />
                ) : (
                  <UnifiedListCard
                    key={`video-${item.list.pubkey}-${item.list.id}`}
                    kind={30005}
                    list={item.list}
                  />
                )
              )}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <BookmarkSimple className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No saved lists.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create List Dialog */}
      {showCreateDialog && (
        <CreatePeopleListDialog
          open={showCreateDialog}
          onOpenChange={(open) => setShowCreateDialog(open)}
        />
      )}
    </div>
  );
}
