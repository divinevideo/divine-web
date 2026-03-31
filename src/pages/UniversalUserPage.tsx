// ABOUTME: Universal user page that handles both NIP-05 and Vine user ID lookups
// ABOUTME: Determines whether the parameter is a NIP-05 identifier or Vine user ID and routes accordingly

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { debugLog } from '@/lib/debug';

const VINE_USER_ID_PATTERN = /^\d{15,20}$/;
const VINE_HOSTNAME_PATTERN = /(^|\.)vine\.co$/i;
const VINE_RESERVED_PATHS = new Set([
  'about',
  'explore',
  'help',
  'login',
  'messages',
  'privacy',
  'search',
  'settings',
  'u',
  'v',
  'terms',
]);

type ProfileMetadata = Record<string, unknown>;
type UserLookupType = 'vine' | 'nip05';

interface ProfileLookupResult {
  pubkey: string;
  metadata: ProfileMetadata;
  type: UserLookupType;
}

interface ParsedProfile {
  pubkey: string;
  metadata: ProfileMetadata;
}

class UserNotFoundError extends Error {}

/**
 * Determines if a string is likely a Vine user ID (all numeric) or NIP-05 identifier
 */
function isVineUserId(identifier: string): boolean {
  return VINE_USER_ID_PATTERN.test(identifier);
}

function decodeIdentifier(identifier: string): string {
  try {
    return decodeURIComponent(identifier);
  } catch {
    return identifier;
  }
}

function parseHttpUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidates = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? [trimmed]
    : [`https://${trimmed}`];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parseProfileMetadata(content: string): ProfileMetadata | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed as ProfileMetadata : null;
  } catch {
    return null;
  }
}

function getStringRecordValue(record: unknown, key: string): string | null {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() || null : null;
}

function parseLegacyVineProfileUsername(value: string): string | null {
  const url = parseHttpUrl(value);
  if (!url || !VINE_HOSTNAME_PATTERN.test(url.hostname)) {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 1) {
    return null;
  }

  const username = decodeIdentifier(segments[0]).trim();
  if (!username || VINE_RESERVED_PATHS.has(username.toLowerCase())) {
    return null;
  }

  return username;
}

function extractLegacyVineUsername(metadata: ProfileMetadata): string | null {
  const vineUsername = getStringRecordValue(metadata.vine_metadata, 'username');
  if (vineUsername) {
    return vineUsername;
  }

  return typeof metadata.website === 'string'
    ? parseLegacyVineProfileUsername(metadata.website)
    : null;
}

function extractVineUserId(metadata: ProfileMetadata): string | null {
  const vineUserId = getStringRecordValue(metadata.vine_metadata, 'user_id');
  if (vineUserId) {
    return vineUserId;
  }

  if (typeof metadata.website !== 'string') {
    return null;
  }

  const url = parseHttpUrl(metadata.website);
  if (!url || !VINE_HOSTNAME_PATTERN.test(url.hostname)) {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'u' || segments.length !== 2) {
    return null;
  }

  return VINE_USER_ID_PATTERN.test(segments[1]) ? segments[1] : null;
}

function getParsedProfiles(events: Array<{ pubkey: string; content: string }>): ParsedProfile[] {
  return events.flatMap((event) => {
    const metadata = parseProfileMetadata(event.content);
    return metadata ? [{ pubkey: event.pubkey, metadata }] : [];
  });
}

function getLookupLabel(identifier: string): string {
  if (isVineUserId(identifier)) {
    return 'Vine ID';
  }

  return decodeIdentifier(identifier).includes('@')
    ? 'NIP-05 identifier'
    : 'legacy Vine username or NIP-05 identifier';
}

function getNotFoundDescription(identifier: string): string {
  if (isVineUserId(identifier)) {
    return 'This Vine user may not have been imported to the Nostr network yet.';
  }

  return decodeIdentifier(identifier).includes('@')
    ? 'Please check the NIP-05 identifier is correct.'
    : 'This username does not match a legacy Vine profile or OpenVine handle.';
}

/**
 * Looks up a user by either NIP-05 or Vine user ID
 */
function useUniversalUserLookup(identifier: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['universal-user', identifier],
    queryFn: async (context) => {
      if (!identifier) {
        throw new Error('No identifier provided');
      }

      const decodedIdentifier = decodeIdentifier(identifier).trim();
      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(10000),
      ]);
      const events = await nostr.query([{
        kinds: [0],
        limit: 500,
      }], { signal });
      const profiles = getParsedProfiles(events);

      if (isVineUserId(decodedIdentifier)) {
        // Handle Vine user ID lookup
        debugLog(`[UniversalUserPage] Looking up Vine user ID: ${decodedIdentifier}`);
        debugLog(`[UniversalUserPage] Searching through ${profiles.length} profiles for Vine ID`);

        for (const profile of profiles) {
          if (extractVineUserId(profile.metadata) === decodedIdentifier) {
            debugLog(`[UniversalUserPage] Found Vine user: ${profile.metadata.name}`);
            return {
              pubkey: profile.pubkey,
              metadata: profile.metadata,
              type: 'vine',
            } satisfies ProfileLookupResult;
          }
        }

        throw new UserNotFoundError(`No user found with Vine ID: ${decodedIdentifier}`);
      } else {
        debugLog(`[UniversalUserPage] Looking up username or NIP-05: ${decodedIdentifier}`);

        const normalizedIdentifier = decodedIdentifier.toLowerCase();
        if (!decodedIdentifier.includes('@')) {
          for (const profile of profiles) {
            const legacyUsername = extractLegacyVineUsername(profile.metadata);
            if (legacyUsername?.toLowerCase() === normalizedIdentifier) {
              debugLog(`[UniversalUserPage] Found legacy Vine user: ${profile.metadata.name}`);
              return {
                pubkey: profile.pubkey,
                metadata: profile.metadata,
                type: 'vine',
              } satisfies ProfileLookupResult;
            }
          }
        }

        const nip05Identifier = decodedIdentifier.includes('@')
          ? decodedIdentifier
          : `${decodedIdentifier}@openvine.co`;

        for (const profile of profiles) {
          const nip05 = getStringRecordValue(profile.metadata, 'nip05');
          if (nip05?.toLowerCase() === nip05Identifier.toLowerCase()) {
            debugLog(`[UniversalUserPage] Found NIP-05 user: ${profile.metadata.name}`);
            return {
              pubkey: profile.pubkey,
              metadata: profile.metadata,
              type: 'nip05',
            } satisfies ProfileLookupResult;
          }
        }

        throw new UserNotFoundError(`No user found with NIP-05: ${nip05Identifier}`);
      }
    },
    enabled: !!identifier,
    staleTime: 300000,
    gcTime: 600000,
    retry: (failureCount, error) => !(error instanceof UserNotFoundError) && failureCount < 2,
  });
}

export function UniversalUserPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useUniversalUserLookup(userId);

  useEffect(() => {
    if (data?.pubkey) {
      // Redirect to the Nostr profile page
      const npub = nip19.npubEncode(data.pubkey);
      debugLog(`[UniversalUserPage] Redirecting to profile: ${npub}`);
      navigate(`/${npub}`, { replace: true });
    }
  }, [data, navigate]);

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Looking up user...
              </p>
              <p className="text-sm text-muted-foreground">
                {getLookupLabel(userId || '')}: {userId}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">User Not Found</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Could not find a user with {getLookupLabel(userId || '')}:
                <code className="text-sm bg-muted px-2 py-1 rounded ml-2">{userId}</code>
              </p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {getNotFoundDescription(userId || '')}
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:brightness-110 transition-colors"
              >
                Go to Home
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // While redirecting
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Redirecting to profile...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
