// ABOUTME: Dialog for viewing raw Nostr event JSON source
// ABOUTME: Shows formatted event data for debugging and transparency

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Code, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';
import { API_CONFIG } from '@/config/api';

interface ViewSourceDialogProps {
  open: boolean;
  onClose: () => void;
  event?: NostrEvent;
  video?: ParsedVideoData;
  title?: string;
}

// Helper function to reconstruct a basic NostrEvent from ParsedVideoData
function reconstructEvent(video: ParsedVideoData): Partial<NostrEvent> {
  const tags: string[][] = [];

  // Add d tag (required for addressable events)
  if (video.vineId) {
    tags.push(['d', video.vineId]);
  }

  // Add title
  if (video.title) {
    tags.push(['title', video.title]);
  }

  // Add video URL
  if (video.videoUrl) {
    tags.push(['url', video.videoUrl]);
  }

  // Add thumbnail
  if (video.thumbnailUrl) {
    tags.push(['thumb', video.thumbnailUrl]);
  }

  // Add duration
  if (video.duration) {
    tags.push(['duration', video.duration.toString()]);
  }

  // Add hashtags
  for (const tag of video.hashtags) {
    tags.push(['t', tag]);
  }

  // Add origin platform if vine
  if (video.isVineMigrated) {
    tags.push(['platform', 'vine']);
  }

  // Add loop count if available (vine stat)
  if (video.loopCount && video.loopCount > 0) {
    tags.push(['loops', video.loopCount.toString()]);
  }

  return {
    id: video.id,
    pubkey: video.pubkey,
    created_at: video.createdAt,
    kind: video.kind,
    content: video.content,
    tags,
    // Note: sig field is not available in parsed data
  };
}

// Fetch full event from Funnelcake API
async function fetchFullEvent(eventId: string): Promise<NostrEvent | null> {
  try {
    const response = await fetch(`${API_CONFIG.funnelcake.baseUrl}/api/event/${eventId}`);
    if (!response.ok) {
      console.error('Failed to fetch event:', response.status);
      return null;
    }
    const data = await response.json();
    return data as NostrEvent;
  } catch (err) {
    console.error('Failed to fetch event:', err);
    return null;
  }
}

export function ViewSourceDialog({
  open,
  onClose,
  event,
  video,
  title = 'Video Event Source',
}: ViewSourceDialogProps) {
  const [copied, setCopied] = useState(false);
  const [fetchedEvent, setFetchedEvent] = useState<NostrEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Fetch full event when dialog opens and we don't have original
  useEffect(() => {
    if (open && !event && !video?.originalEvent && video?.id) {
      setLoading(true);
      setFetchError(false);
      fetchFullEvent(video.id)
        .then(result => {
          setFetchedEvent(result);
          setFetchError(!result);
        })
        .finally(() => setLoading(false));
    }
  }, [open, event, video?.originalEvent, video?.id]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFetchedEvent(null);
      setFetchError(false);
    }
  }, [open]);

  // Use provided event, or fetched event, or originalEvent from video data, or reconstruct
  const displayEvent = event || fetchedEvent || video?.originalEvent || (video ? reconstructEvent(video) : null);
  const isReconstructed = !event && !fetchedEvent && !video?.originalEvent && !!video;
  const hasFullEvent = !!event || !!fetchedEvent || !!video?.originalEvent;

  if (!displayEvent) {
    return null;
  }

  const eventJson = JSON.stringify(displayEvent, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(eventJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Raw Nostr event JSON (NIP-01 format)
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading full event...</span>
          </div>
        )}

        {!loading && isReconstructed && (
          <div className="bg-brand-yellow-light border border-brand-yellow rounded-lg p-3 flex items-start gap-2 dark:bg-brand-yellow-dark">
            <AlertCircle className="h-4 w-4 text-brand-yellow-dark dark:text-brand-yellow shrink-0 mt-0.5" />
            <p className="text-sm text-brand-yellow-dark dark:text-brand-yellow-light">
              <strong>Note:</strong> {fetchError
                ? 'Could not fetch full event from relay. This is a reconstructed representation from cached data.'
                : 'This is a reconstructed representation from parsed data. The original event signature and some tags may not be included.'}
            </p>
          </div>
        )}

        {!loading && hasFullEvent && (
          <div className="bg-brand-light-green border border-brand-green rounded-lg p-3 flex items-start gap-2 dark:bg-brand-dark-green">
            <Check className="h-4 w-4 text-brand-dark-green dark:text-brand-green shrink-0 mt-0.5" />
            <p className="text-sm text-brand-dark-green dark:text-brand-light-green">
              <strong>Verified:</strong> This is the complete original event with cryptographic signature.
            </p>
          </div>
        )}

        {!loading && (
          <div className="flex-1 overflow-auto">
            <pre className="bg-brand-light-green rounded-lg p-4 text-xs overflow-x-auto dark:bg-brand-dark-green">
              <code className="font-mono text-foreground">{eventJson}</code>
            </pre>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            Event ID: <code className="bg-muted px-1 py-0.5 rounded">{displayEvent.id}</code>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={loading}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </>
              )}
            </Button>
            <Button variant="default" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
