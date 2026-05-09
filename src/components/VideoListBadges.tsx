// ABOUTME: Component for displaying which lists a video appears in
// ABOUTME: Shows list badges with links to list pages and quick add/remove actions

import { Link } from 'react-router-dom';
import { useVideosInLists } from '@/hooks/useVideoLists';
import { useAuthor } from '@/hooks/useAuthor';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { List, Plus, Users } from '@phosphor-icons/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { genUserName } from '@/lib/genUserName';
import { useState } from 'react';
import { AddToListDialog } from './AddToListDialog';

interface VideoListBadgesProps {
  videoId: string;
  videoPubkey: string;
  compact?: boolean;
  showAddButton?: boolean;
  className?: string;
}

function ListBadge({ 
  listId, 
  listName, 
  listPubkey,
  videoCount
}: { 
  listId: string;
  listName: string;
  listPubkey: string;
  videoCount: number;
}) {
  const author = useAuthor(listPubkey);
  const authorName = author.data?.metadata?.name || genUserName(listPubkey);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link to={`/list/${listPubkey}/${listId}`}>
            <Badge 
              variant="secondary" 
              className="hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
            >
              <List className="h-3 w-3 mr-1" />
              {listName}
            </Badge>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-medium">{listName}</p>
            <p className="text-muted-foreground">by {authorName}</p>
            <p className="text-muted-foreground">{videoCount} videos</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function VideoListBadges({
  videoId,
  videoPubkey,
  compact = false,
  showAddButton = true,
  className = ''
}: VideoListBadgesProps) {
  const { data: lists, isLoading } = useVideosInLists(videoId);
  const [showAddDialog, setShowAddDialog] = useState(false);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
    );
  }

  if (!lists || lists.length === 0) {
    if (!showAddButton) return null;
    
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="h-6 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add to list
        </Button>
        {showAddDialog && (
          <AddToListDialog
            videoId={videoId}
            videoPubkey={videoPubkey}
            open={showAddDialog}
            onClose={() => setShowAddDialog(false)}
          />
        )}
      </div>
    );
  }

  const displayLists = compact ? lists.slice(0, 3) : lists;
  const remainingCount = lists.length - displayLists.length;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* List count indicator */}
      {lists.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{lists.length}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">In {lists.length} list{lists.length !== 1 ? 's' : ''}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* List badges */}
      {displayLists.map((list) => (
        <ListBadge
          key={`${list.pubkey}-${list.id}`}
          listId={list.id}
          listName={list.name}
          listPubkey={list.pubkey}
          videoCount={list.videoCoordinates.length}
        />
      ))}

      {/* More indicator */}
      {remainingCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                +{remainingCount} more
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1 max-w-xs">
                <p className="font-medium">Also in:</p>
                {lists.slice(3).map(list => (
                  <p key={`${list.pubkey}-${list.id}`} className="text-muted-foreground">
                    • {list.name}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Add to list button */}
      {showAddButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="h-6 px-2 text-xs"
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}

      {/* Add to list dialog */}
      {showAddDialog && (
        <AddToListDialog
          videoId={videoId}
          videoPubkey={videoPubkey}
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}