import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Code, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { useAppContext } from '@/hooks/useAppContext';
import { useAuthor } from '@/hooks/useAuthor';
import { fetchAddressableEvent, fetchEventById } from '@/lib/eventLookup';
import {
  buildEventPath,
  buildProfilePath,
  buildResolvedEventRoute,
  getEventDTag,
  isListEventKind,
  isNoteEventKind,
} from '@/lib/eventRouting';
import { getDirectSearchTarget } from '@/lib/directSearch';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { NoteContent } from '@/components/NoteContent';
import { SmartLink } from '@/components/SmartLink';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { NostrEvent } from '@nostrify/nostrify';

function getTagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find(tag => tag[0] === name)?.[1];
}

function getEventTitle(event: NostrEvent): string {
  return getTagValue(event, 'title')
    || getTagValue(event, 'subject')
    || getTagValue(event, 'name')
    || getEventDTag(event)
    || getEventKindLabel(event.kind);
}

function getEventKindLabel(kind: number): string {
  switch (kind) {
    case 1:
      return 'Text Note';
    case 1111:
      return 'Comment';
    case 30005:
      return 'Video List';
    case 3:
      return 'Follow List';
    default:
      return isListEventKind(kind) ? `List ${kind}` : `Kind ${kind}`;
  }
}

function getReferencePath(tag: string[]): string | null {
  if (tag[0] === 'p' && tag[1]) {
    return buildProfilePath(nip19.npubEncode(tag[1]));
  }

  if (tag[0] === 'e' && tag[1]) {
    return buildEventPath(tag[1]);
  }

  if (tag[0] === 'a' && tag[1]) {
    return getDirectSearchTarget(tag[1])?.path || null;
  }

  if (tag[0] === 't' && tag[1]) {
    return `/t/${encodeURIComponent(tag[1].toLowerCase())}`;
  }

  return null;
}

function getReferenceLabel(tag: string[]): string {
  switch (tag[0]) {
    case 'p':
      return 'Profile';
    case 'e':
      return 'Event';
    case 'a':
      return 'Address';
    case 't':
      return 'Hashtag';
    default:
      return tag[0];
  }
}

function EventLoadingState() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading event…</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getRelayHints(search: string): string[] {
  const params = new URLSearchParams(search);
  return params
    .getAll('relays')
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean);
}

export function EventPage() {
  const { eventId, kind, pubkey, identifier } = useParams<{
    eventId?: string;
    kind?: string;
    pubkey?: string;
    identifier?: string;
  }>();
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const navigate = useSubdomainNavigate();
  const location = useLocation();

  const numericKind = kind ? Number(kind) : null;
  const decodedIdentifier = identifier ? decodeURIComponent(identifier) : null;
  const relayHints = getRelayHints(location.search);
  const configuredRelayUrls = config.relayUrls || [config.relayUrl];
  const relayKey = [...configuredRelayUrls, ...relayHints].join(',');

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event-page', eventId, numericKind, pubkey, decodedIdentifier, relayKey],
    queryFn: async (context) => {
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(10000)]);

      if (eventId) {
        return fetchEventById(nostr, eventId, signal, {
          relayHints,
          relayUrls: configuredRelayUrls,
        });
      }

      if (numericKind && pubkey && decodedIdentifier) {
        return fetchAddressableEvent(nostr, {
          kind: numericKind,
          pubkey,
          identifier: decodedIdentifier,
        }, signal, {
          relayHints,
          relayUrls: configuredRelayUrls,
        });
      }

      return null;
    },
    enabled: !!eventId || (!!numericKind && !!pubkey && !!decodedIdentifier),
    staleTime: 60000,
    gcTime: 300000,
  });

  const author = useAuthor(event?.pubkey || '');
  const authorName = event
    ? author.data?.metadata?.display_name
      || author.data?.metadata?.name
      || genUserName(event.pubkey)
    : '';
  const authorImage = getSafeProfileImage(author.data?.metadata?.picture);
  const authorNpub = event ? nip19.npubEncode(event.pubkey) : '';
  const title = event ? getEventTitle(event) : '';
  const description = event ? getTagValue(event, 'description') : undefined;
  const content = event?.content?.trim();
  const referenceTags = event
    ? event.tags.filter(tag => ['a', 'e', 'p', 't'].includes(tag[0]) && tag[1])
    : [];
  const redirectPath = event ? buildResolvedEventRoute(event) : null;

  if (isLoading) {
    return <EventLoadingState />;
  }

  if (!eventId && (!numericKind || !pubkey || !decodedIdentifier)) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No event identifier provided.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (event && redirectPath && redirectPath !== location.pathname) {
    return <Navigate to={redirectPath} replace />;
  }

  if (!event) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-lg font-semibold text-muted-foreground">Event not found</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'This event may not exist on the configured or fallback relays.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Button variant="ghost" className="gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{getEventKindLabel(event.kind)}</Badge>
            <Badge variant="outline">Kind {event.kind}</Badge>
            <Badge variant="outline">{formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true })}</Badge>
          </div>
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              {authorImage ? <AvatarImage src={authorImage} alt={authorName} /> : null}
              <AvatarFallback>{authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <SmartLink to={buildProfilePath(authorNpub)} ownerPubkey={event.pubkey} className="hover:underline">
                  {authorName}
                </SmartLink>
                <span>·</span>
                <span className="font-mono text-xs">{event.id.slice(0, 16)}…</span>
              </CardDescription>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
        </CardHeader>
        {(content || isNoteEventKind(event.kind)) && (
          <CardContent>
            {isNoteEventKind(event.kind) ? (
              <NoteContent event={event} className="text-base leading-7" />
            ) : content ? (
              <div className="whitespace-pre-wrap break-words text-sm text-foreground">{content}</div>
            ) : null}
          </CardContent>
        )}
      </Card>

      {isListEventKind(event.kind) && (
        <Card>
          <CardHeader>
            <CardTitle>List Items</CardTitle>
            <CardDescription>
              References contained in this event.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referenceTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">This list does not contain any public references.</p>
            ) : (
              <div className="space-y-3">
                {referenceTags.map((tag, index) => {
                  const path = getReferencePath(tag);
                  const label = getReferenceLabel(tag);
                  const value = tag[1];

                  return (
                    <div key={`${tag[0]}-${value}-${index}`} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="secondary">{label}</Badge>
                        <span className="font-mono text-xs text-muted-foreground break-all">{value}</span>
                      </div>
                      {path ? (
                        <SmartLink to={path} className="text-sm text-primary hover:underline">
                          Open referenced item
                        </SmartLink>
                      ) : (
                        <p className="text-sm text-muted-foreground">No route available for this reference.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>{event.tags.length} tags</CardDescription>
        </CardHeader>
        <CardContent>
          {event.tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags on this event.</p>
          ) : (
            <div className="space-y-2">
              {event.tags.map((tag, index) => (
                <div key={`${tag[0]}-${index}`} className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
                  {JSON.stringify(tag)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Raw Event
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            {JSON.stringify(event, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

export default EventPage;
