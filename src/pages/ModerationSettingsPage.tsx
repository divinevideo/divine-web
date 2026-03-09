// ABOUTME: Settings page for content moderation
// ABOUTME: Manage mute lists, view report history, and configure filtering

import { useState, useEffect } from 'react';
import { useMuteList, useMuteItem, useUnmuteItem, useReportHistory } from '@/hooks/useModeration';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useNostr } from '@nostrify/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Shield,
  UserX,
  Hash,
  Type,
  Plus,
  Flag,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { MuteType, REPORT_REASON_LABELS } from '@/types/moderation';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { formatDistanceToNow } from 'date-fns';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

function MutedUserItem({ pubkey, reason, onUnmute }: {
  pubkey: string;
  reason?: string;
  onUnmute: () => void;
}) {
  const author = useAuthor(pubkey);
  const authorMetadata = author.data?.metadata;
  const authorName = authorMetadata?.name || genUserName(pubkey);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <Avatar size="md">
          <AvatarImage src={getSafeProfileImage(authorMetadata?.picture)} />
          <AvatarFallback>{authorName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{authorName}</p>
          {reason && (
            <p className="text-xs text-muted-foreground">{reason}</p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onUnmute}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Unmute
      </Button>
    </div>
  );
}



export default function ModerationSettingsPage() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { toast } = useToast();
  const { data: muteList = [], isLoading: muteListLoading } = useMuteList();
  const { data: reportHistory = [] } = useReportHistory();
  const muteItem = useMuteItem();
  const unmuteItem = useUnmuteItem();

  const [muteType, setMuteType] = useState<MuteType>(MuteType.USER);
  const [muteValue, setMuteValue] = useState('');
  const [muteReason, setMuteReason] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [rawMuteEvent, setRawMuteEvent] = useState<NostrEvent | null>(null);

  const mutedUsers = muteList.filter(item => item.type === MuteType.USER);
  const mutedHashtags = muteList.filter(item => item.type === MuteType.HASHTAG);
  const mutedKeywords = muteList.filter(item => item.type === MuteType.KEYWORD);

  // Debug: Log state
  console.log('[ModerationSettingsPage] Render state:', {
    user: user?.pubkey,
    muteListLoading,
    muteListLength: muteList.length,
    mutedUsers: mutedUsers.length,
    mutedHashtags: mutedHashtags.length,
    mutedKeywords: mutedKeywords.length,
    muteList
  });

  // Fetch raw mute list event for debugging
  useEffect(() => {
    if (!user || !showDebug) return;

    const fetchRawEvent = async () => {
      try {
        const events = await nostr.query([{
          kinds: [10001],
          authors: [user.pubkey],
          limit: 1
        }], { signal: AbortSignal.timeout(5000) });

        if (events.length > 0) {
          setRawMuteEvent(events[0]);
          console.log('[ModerationSettingsPage] Raw mute event:', events[0]);
        } else {
          setRawMuteEvent(null);
          console.log('[ModerationSettingsPage] No mute event found');
        }
      } catch (error) {
        console.error('[ModerationSettingsPage] Error fetching raw event:', error);
      }
    };

    fetchRawEvent();
  }, [user, showDebug, nostr, muteList.length]); // Re-fetch when mute list changes

  const handleMute = async () => {
    if (!muteValue.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a value to mute',
        variant: 'destructive',
      });
      return;
    }

    try {
      let value = muteValue.trim();

      // Handle npub conversion for users
      if (muteType === MuteType.USER) {
        try {
          if (value.startsWith('npub')) {
            const decoded = nip19.decode(value);
            if (decoded.type === 'npub') {
              value = decoded.data;
            }
          }
        } catch {
          toast({
            title: 'Error',
            description: 'Invalid npub format',
            variant: 'destructive',
          });
          return;
        }
      }

      await muteItem.mutateAsync({
        type: muteType,
        value,
        reason: muteReason.trim() || undefined
      });

      toast({
        title: 'Muted',
        description: `Successfully added to mute list`,
      });

      // Reset form
      setMuteValue('');
      setMuteReason('');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to mute. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleUnmute = async (type: MuteType, value: string) => {
    try {
      await unmuteItem.mutateAsync({ type, value });
      toast({
        title: 'Unmuted',
        description: 'Removed from mute list',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unmute. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Authentication Required</p>
            <p className="text-muted-foreground">
              Please log in to manage your moderation settings
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
              <Shield className="h-8 w-8" />
              Moderation Settings
            </h1>
            <p className="text-muted-foreground">
              Control what content you see and report violations
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="text-foreground"
          >
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </Button>
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <Card className="mt-4 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="text-sm">Debug Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm font-mono">
              <div>
                <strong>User pubkey:</strong> {user?.pubkey || 'Not logged in'}
              </div>
              <div>
                <strong>Mute list loading:</strong> {muteListLoading ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Total mute items:</strong> {muteList.length}
              </div>
              <div>
                <strong>Muted users:</strong> {mutedUsers.length}
                {mutedUsers.length > 0 && (
                  <div className="ml-4 mt-1 text-xs break-all">
                    {mutedUsers.map(item => (
                      <div key={item.value} className="py-1">
                        • {item.value} {item.reason && `(${item.reason})`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <strong>Muted hashtags:</strong> {mutedHashtags.length}
                {mutedHashtags.length > 0 && (
                  <div className="ml-4 mt-1 text-xs">
                    {mutedHashtags.map(item => (
                      <span key={item.value} className="mr-2">#{item.value}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <strong>Muted keywords:</strong> {mutedKeywords.length}
                {mutedKeywords.length > 0 && (
                  <div className="ml-4 mt-1 text-xs">
                    {mutedKeywords.map(item => (
                      <span key={item.value} className="mr-2">"{item.value}"</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-yellow-600/50">
                <strong>Parsed mute list:</strong>
                <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(muteList, null, 2)}
                </pre>
              </div>
              {rawMuteEvent && (
                <div className="pt-2 border-t border-yellow-600/50">
                  <strong>Raw Nostr event (kind 10001):</strong>
                  <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-auto max-h-60">
                    {String(JSON.stringify(rawMuteEvent, null, 2))}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Status Card */}
      <Card className="mb-6 border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">
                Moderation Status: {muteListLoading ? 'Loading...' : 'Active'}
              </p>
              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                <div>
                  • <strong>{mutedUsers.length}</strong> users muted
                </div>
                <div>
                  • <strong>{mutedHashtags.length}</strong> hashtags muted
                </div>
                <div>
                  • <strong>{mutedKeywords.length}</strong> keywords muted
                </div>
                {muteList.length > 0 && (
                  <div className="text-green-600 dark:text-green-400 mt-2">
                    ✓ Content filtering is active across all feeds
                  </div>
                )}
                {muteList.length === 0 && !muteListLoading && (
                  <div className="text-muted-foreground mt-2">
                    No filters active - all content will be shown
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="mute-list" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mute-list" className="gap-2">
            <UserX className="h-4 w-4" />
            <span className="hidden sm:inline">Mute List</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <Flag className="h-4 w-4" />
            <span className="hidden sm:inline">My Reports</span>
          </TabsTrigger>
        </TabsList>

        {/* Mute List Tab */}
        <TabsContent value="mute-list" className="space-y-6">
          {/* Add to Mute List */}
          <Card>
            <CardHeader>
              <CardTitle>Add to Mute List</CardTitle>
              <CardDescription>
                Mute users, hashtags, keywords, or specific content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mute-type">Type</Label>
                  <Select value={muteType} onValueChange={(value) => setMuteType(value as MuteType)}>
                    <SelectTrigger id="mute-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MuteType.USER}>
                        <div className="flex items-center gap-2">
                          <UserX className="h-4 w-4" />
                          User (npub or hex)
                        </div>
                      </SelectItem>
                      <SelectItem value={MuteType.HASHTAG}>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Hashtag
                        </div>
                      </SelectItem>
                      <SelectItem value={MuteType.KEYWORD}>
                        <div className="flex items-center gap-2">
                          <Type className="h-4 w-4" />
                          Keyword
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mute-value">
                    {muteType === MuteType.USER && 'User (npub or pubkey)'}
                    {muteType === MuteType.HASHTAG && 'Hashtag (without #)'}
                    {muteType === MuteType.KEYWORD && 'Keyword or phrase'}
                  </Label>
                  <Input
                    id="mute-value"
                    placeholder={
                      muteType === MuteType.USER ? 'npub1...' :
                      muteType === MuteType.HASHTAG ? 'spam' :
                      'unwanted phrase'
                    }
                    value={muteValue}
                    onChange={(e) => setMuteValue(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mute-reason">Reason (optional)</Label>
                <Input
                  id="mute-reason"
                  placeholder="Why are you muting this?"
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                />
              </div>

              <Button onClick={handleMute} disabled={!muteValue.trim() || muteItem.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Add to Mute List
              </Button>
            </CardContent>
          </Card>

          {/* Muted Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                Muted Users ({mutedUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {muteListLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : mutedUsers.length > 0 ? (
                <div className="space-y-2">
                  {mutedUsers.map((item) => (
                    <MutedUserItem
                      key={item.value}
                      pubkey={item.value}
                      reason={item.reason}
                      onUnmute={() => handleUnmute(MuteType.USER, item.value)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No muted users
                </p>
              )}
            </CardContent>
          </Card>

          {/* Muted Hashtags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Muted Hashtags ({mutedHashtags.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mutedHashtags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {mutedHashtags.map((item) => (
                    <Badge key={item.value} variant="secondary" className="gap-2">
                      #{item.value}
                      <button
                        onClick={() => handleUnmute(MuteType.HASHTAG, item.value)}
                        className="hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No muted hashtags
                </p>
              )}
            </CardContent>
          </Card>

          {/* Muted Keywords */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Muted Keywords ({mutedKeywords.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mutedKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {mutedKeywords.map((item) => (
                    <Badge key={item.value} variant="secondary" className="gap-2">
                      {item.value}
                      <button
                        onClick={() => handleUnmute(MuteType.KEYWORD, item.value)}
                        className="hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No muted keywords
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report History</CardTitle>
              <CardDescription>
                Content you've reported ({reportHistory.length})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportHistory.length > 0 ? (
                <div className="space-y-4">
                  {reportHistory.map((report) => (
                    <div key={report.reportId} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-destructive" />
                          <span className="font-medium">
                            {REPORT_REASON_LABELS[report.reason]}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(report.createdAt * 1000, { addSuffix: true })}
                        </span>
                      </div>
                      {report.details && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {report.details}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                        {report.eventId && (
                          <span className="font-mono">Event: {report.eventId.slice(0, 8)}...</span>
                        )}
                        {report.pubkey && (
                          <span className="font-mono">User: {report.pubkey.slice(0, 8)}...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    You haven't reported any content yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
