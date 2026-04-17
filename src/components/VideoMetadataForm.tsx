// ABOUTME: Responsive form for adding title, description, and hashtags to recorded videos
// ABOUTME: Handles video preview and publishing with metadata - mobile-first design

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Hash, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import { usePublishVideo } from '@/hooks/usePublishVideo';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface VideoSegment {
  blob: Blob;
  blobUrl: string;
}

interface VideoMetadataFormProps {
  segments: VideoSegment[];
  onCancel: () => void;
  onPublished: () => void;
}

export function VideoMetadataForm({
  segments,
  onCancel,
  onPublished,
}: VideoMetadataFormProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { uploadVideo, uploadProgress, isUploading } = useVideoUpload();
  const { mutateAsync: publishVideo, isPending: isPublishing } = usePublishVideo();

  const isProcessing = isUploading || isPublishing;

  // Detect desktop
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Set up video preview
  useEffect(() => {
    if (videoRef.current && segments.length > 0) {
      videoRef.current.src = segments[0].blobUrl;
      videoRef.current.loop = true;
      videoRef.current.play().catch(console.error);
    }
  }, [segments]);

  // Add hashtag
  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '').toLowerCase();
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput('');
    }
  };

  // Remove hashtag
  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter(t => t !== tag));
  };

  // Handle hashtag input key press
  const handleHashtagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      addHashtag();
    }
  };

  // Publish video
  const handlePublish = async () => {
    if (!title.trim()) {
      toast({
        title: 'Give it a title.',
        description: 'Your loop needs a name before it goes live.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Step 1: Upload video to Blossom
      const uploadResult = await uploadVideo({
        segments,
        filename: `vine-${Date.now()}.webm`,
      });

      // Step 2: Publish to Nostr
      await publishVideo({
        content: description,
        videoUrl: uploadResult.url,
        title: title.trim(),
        duration: Math.round(uploadResult.duration / 1000), // Convert ms to seconds
        hashtags,
      });

      toast({
        title: 'Your loop is live.',
        description: 'Let\'s go.',
      });

      onPublished();
    } catch (error) {
      console.error('Failed to publish video:', error);
      toast({
        title: 'Didn\'t make it out.',
        description: error instanceof Error ? error.message : 'Publish hit a snag. Try again?',
        variant: 'destructive',
      });
    }
  };

  const currentProgress = isUploading 
    ? uploadProgress * 80 // Upload is 80% of total progress
    : isPublishing 
    ? 80 + (20) // Publishing is the final 20%
    : 0;

  // Form content
  const formContent = (
    <div className="flex flex-col h-full bg-background">
      {/* Video Preview - responsive aspect ratio */}
      <div className={cn(
        "relative bg-black flex-shrink-0",
        "aspect-[9/16] max-h-[50vh]",
        "md:aspect-video md:max-h-[40vh]"
      )}>
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          muted
          loop
        />
      </div>

      {/* Metadata Form - scrollable */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'var(--sab)' }}>
        <div className="p-4 space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Name your loop"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              disabled={isProcessing}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {title.length}/100 characters
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Say something about it..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={isProcessing}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {description.length}/500 characters
            </p>
          </div>

          <div>
            <Label htmlFor="hashtags">Hashtags</Label>
            <div className="flex gap-2 mt-1.5">
              <div className="relative flex-1">
                <Hash className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="hashtags"
                  placeholder="Tag it up (hit Enter)"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={handleHashtagKeyPress}
                  onBlur={addHashtag}
                  className="pl-8"
                  disabled={isProcessing}
                />
              </div>
              <Button
                onClick={addHashtag}
                variant="outline"
                size="sm"
                disabled={!hashtagInput.trim() || isProcessing}
              >
                Add
              </Button>
            </div>

            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {hashtags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    #{tag}
                    <button
                      onClick={() => removeHashtag(tag)}
                      className="ml-1 hover:text-destructive"
                      disabled={isProcessing}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {isProcessing && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isUploading ? 'Uploading video...' : 'Publishing to Nostr...'}
                </span>
                <span className="font-medium">{Math.round(currentProgress)}%</span>
              </div>
              <Progress value={currentProgress} className="h-2" />
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons - fixed at bottom */}
      <div className="border-t bg-background flex-shrink-0">
        <div className="p-4 space-y-2">
          <Button
            onClick={handlePublish}
            className="w-full h-11"
            disabled={isProcessing || !title.trim()}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUploading ? 'Uploading...' : 'Publishing...'}
              </>
            ) : (
              'Publish Vine'
            )}
          </Button>

          <Button
            onClick={onCancel}
            variant="outline"
            className="w-full h-11"
            disabled={isProcessing}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  // Desktop: wrap in centered modal
  if (isDesktop) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl bg-background">
          {formContent}
        </div>
      </div>
    );
  }

  // Mobile: full screen
  return formContent;
}
