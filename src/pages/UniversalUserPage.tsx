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

/**
 * Determines if a string is likely a Vine user ID (all numeric) or NIP-05 identifier
 */
function isVineUserId(identifier: string): boolean {
  // Vine user IDs are typically long numeric strings (16-19 digits)
  // Example: 1080167736266633216
  return /^\d{15,20}$/.test(identifier);
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

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(10000),
      ]);

      if (isVineUserId(identifier)) {
        // Handle Vine user ID lookup
        debugLog(`[UniversalUserPage] Looking up Vine user ID: ${identifier}`);

        // Query for kind 0 events and search for matching vine_metadata.user_id
        // Use smaller batches for better performance
        const events = await nostr.query([{
          kinds: [0],
          limit: 500, // Reduced from 5000 for performance
        }], { signal });

        debugLog(`[UniversalUserPage] Searching through ${events.length} profiles for Vine ID`);

        for (const event of events) {
          try {
            const metadata = JSON.parse(event.content);
            // Check both vine_metadata.user_id and website URL
            if (metadata.vine_metadata?.user_id === identifier || 
                metadata.website?.includes(`/u/${identifier}`)) {
              debugLog(`[UniversalUserPage] Found Vine user: ${metadata.name}`);
              return {
                pubkey: event.pubkey,
                metadata,
                type: 'vine',
              };
            }
          } catch {
            continue;
          }
        }

        throw new Error(`No user found with Vine ID: ${identifier}`);
      } else {
        // Handle NIP-05 lookup
        debugLog(`[UniversalUserPage] Looking up NIP-05: ${identifier}`);
        
        // For NIP-05, we need to handle the @ symbol properly
        // The identifier might come as "username" and we need to add the domain
        let nip05Identifier = identifier;
        
        // If it doesn't contain @, assume it's a username for openvine.co
        if (!identifier.includes('@')) {
          nip05Identifier = `${identifier}@openvine.co`;
        } else {
          // URL decode in case @ was encoded
          nip05Identifier = decodeURIComponent(identifier);
        }

        // Query for kind 0 events with matching NIP-05
        const events = await nostr.query([{
          kinds: [0],
          limit: 500, // Reduced from 5000 for performance
        }], { signal });

        for (const event of events) {
          try {
            const metadata = JSON.parse(event.content);
            if (metadata.nip05?.toLowerCase() === nip05Identifier.toLowerCase()) {
              debugLog(`[UniversalUserPage] Found NIP-05 user: ${metadata.name}`);
              return {
                pubkey: event.pubkey,
                metadata,
                type: 'nip05',
              };
            }
          } catch {
            continue;
          }
        }

        throw new Error(`No user found with NIP-05: ${nip05Identifier}`);
      }
    },
    enabled: !!identifier,
    staleTime: 300000,
    gcTime: 600000,
    retry: 2,
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
                Looking up {isVineUserId(userId || '') ? 'Vine' : 'NIP-05'} user...
              </p>
              <p className="text-sm text-muted-foreground">
                {isVineUserId(userId || '') ? 'User ID' : 'NIP-05'}: {userId}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const isVineId = isVineUserId(userId || '');
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">User Not Found</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Could not find a user with {isVineId ? 'Vine ID' : 'NIP-05 identifier'}: 
                <code className="text-sm bg-muted px-2 py-1 rounded ml-2">{userId}</code>
              </p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {isVineId 
                  ? 'This Vine user may not have been imported to the Nostr network yet.'
                  : 'Please check the NIP-05 identifier is correct.'}
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