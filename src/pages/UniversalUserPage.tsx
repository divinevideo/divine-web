// ABOUTME: Universal user page that handles both NIP-05 and Vine user ID lookups
// ABOUTME: Determines whether the parameter is a NIP-05 identifier or Vine user ID and routes accordingly

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card, CardContent } from '@/components/ui/card';
import { WarningCircle as AlertCircle, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { debugLog } from '@/lib/debug';
import { nip05CandidatesFromUrlSegment } from '@/lib/profileLinks';
import { resolveNip05ToPubkey } from '@/lib/nip05Resolve';
import { DIVINE_APEX_DOMAINS } from '@/lib/nip05Utils';
import ProfilePage from './ProfilePage';

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

function getLookupLabel(identifier: string, t: TFunction): string {
  if (isVineUserId(identifier)) {
    return t('universalUserPage.lookupLabel.vineId');
  }

  const decoded = decodeIdentifier(identifier);
  const looksLikeNip05 = decoded.includes('@') || decoded.includes('.');
  return looksLikeNip05
    ? t('universalUserPage.lookupLabel.nip05')
    : t('universalUserPage.lookupLabel.legacyOrNip05');
}

function getNotFoundDescription(identifier: string, t: TFunction): string {
  if (isVineUserId(identifier)) {
    return t('universalUserPage.notFoundDescription.vine');
  }

  const decoded = decodeIdentifier(identifier);
  const looksLikeNip05 = decoded.includes('@') || decoded.includes('.');
  return looksLikeNip05
    ? t('universalUserPage.notFoundDescription.nip05')
    : t('universalUserPage.notFoundDescription.legacy');
}

/**
 * Looks up a user by either NIP-05 or Vine user ID
 */
/**
 * Strip the NIP-05 envelope from a /u/ URL segment, leaving the bare local
 * part. We deliberately do NOT resolve the raw NIP-05 string itself — only
 * the canonical /u/<sub> path runs through the lookup. Third-party segments
 * (anything that doesn't match a known divine.video apex) pass through
 * unchanged and the lookup below will report not-found.
 */
const NIP05_ENVELOPE_PATTERN = new RegExp(
  `^(_@([^.]+)\\.(?:${DIVINE_APEX_DOMAINS.join('|')})|([^@]+)@${DIVINE_APEX_DOMAINS.map(a => a.replace('.', '\\.')).join('|')})$`,
  'i',
);

function stripNip05Envelope(segment: string): string | null {
  const decoded = decodeURIComponent(segment).trim();
  const match = decoded.match(NIP05_ENVELOPE_PATTERN);
  if (!match) return null;
  return (match[2] ?? match[3]).toLowerCase();
}

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
      }

      debugLog(`[UniversalUserPage] Looking up username or NIP-05: ${decodedIdentifier}`);

      // Legacy Vine username: no '@' and no '.' — try matching against
      // `vine_metadata.username` / `website` profiles.
      const normalizedIdentifier = decodedIdentifier.toLowerCase();
      if (!decodedIdentifier.includes('@') && !decodedIdentifier.includes('.')) {
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

      // NIP-05 path: expand the URL segment into the canonical NIP-05 strings we
      // expect to find in kind-0 metadata (or resolve via NIP-05 DNS).
      const nip05Candidates = nip05CandidatesFromUrlSegment(decodedIdentifier);
      debugLog(`[UniversalUserPage] NIP-05 candidates for "${decodedIdentifier}": ${JSON.stringify(nip05Candidates)}`);

      const normalizedCandidates = new Set(nip05Candidates.map(c => c.toLowerCase()));
      for (const profile of profiles) {
        const nip = getStringRecordValue(profile.metadata, 'nip05');
        if (nip && normalizedCandidates.has(nip.toLowerCase())) {
          debugLog(`[UniversalUserPage] Found NIP-05 user: ${profile.metadata.name}`);
          return {
            pubkey: profile.pubkey,
            metadata: profile.metadata,
            type: 'nip05',
          } satisfies ProfileLookupResult;
        }
      }

      // DNS NIP-05 fallback. We only attempt this for candidates that contain an
      // '@' (third-party segments with no '@' can't be resolved via DNS — they
      // are tried against kind-0 above and reported as not-found if no match).
      for (const candidate of nip05Candidates) {
        if (!candidate.includes('@')) continue;
        try {
          const pubkey = await resolveNip05ToPubkey(candidate, { signal });
          if (pubkey) {
            debugLog(`[UniversalUserPage] Resolved NIP-05 via DNS: ${candidate} -> ${pubkey}`);
            return {
              pubkey,
              metadata: {},
              type: 'nip05',
            } satisfies ProfileLookupResult;
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
          debugLog(`[UniversalUserPage] DNS NIP-05 lookup failed for ${candidate}: ${(err as Error).message}`);
        }
      }

      throw new UserNotFoundError(`No user found for identifier: ${decodedIdentifier}`);
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
  const { t } = useTranslation();
  const { data, isLoading, error } = useUniversalUserLookup(userId);

  useEffect(() => {
    if (!userId) return;
    const normalized = stripNip05Envelope(userId);
    if (normalized === null) return;
    const { search, hash } = window.location;
    window.history.replaceState(null, '', `/u/${normalized}${search}${hash}`);
  }, [userId]);

  if (data?.pubkey) {
    return <ProfilePage pubkeyOverride={data.pubkey} />;
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {t('universalUserPage.lookingUp')}
              </p>
              <p className="text-sm text-muted-foreground">
                {getLookupLabel(userId || '', t)}: {userId}
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
              <h2 className="text-xl font-semibold">{t('universalUserPage.userNotFound')}</h2>
              <p className="text-muted-foreground text-center max-w-md">
                {t('universalUserPage.couldNotFind', { label: getLookupLabel(userId || '', t) })}
                <code className="text-sm bg-muted px-2 py-1 rounded ml-2">{userId}</code>
              </p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {getNotFoundDescription(userId || '', t)}
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:brightness-110 transition-colors"
              >
                {t('universalUserPage.goHome')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{t('universalUserPage.redirecting')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
