// ABOUTME: Profile page that resolves NIP-05 identifiers to pubkeys and displays profiles
// ABOUTME: Supports URLs like /u/alice@example.com for cleaner profile URLs

import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useNostr } from '@nostrify/react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function NIP05ProfilePage() {
  const { nip05: nip05Param } = useParams<{ nip05: string }>();
  const { nostr } = useNostr();
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveNIP05() {
      if (!nip05Param) {
        setError('No NIP-05 identifier provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Decode the URL parameter (in case it's URL encoded)
        const decodedNip05 = decodeURIComponent(nip05Param);
        
        console.log('[NIP05ProfilePage] Searching relay for NIP-05:', decodedNip05);
        
        // Search the relay for kind 0 events (profiles) that have this NIP-05
        const signal = AbortSignal.timeout(5000);
        const events = await nostr.query(
          [{ kinds: [0], limit: 100 }],
          { signal }
        );
        
        // Look through profiles to find one with matching NIP-05
        let foundPubkey: string | null = null;
        
        for (const event of events) {
          try {
            const metadata = JSON.parse(event.content);
            if (metadata.nip05 && metadata.nip05.toLowerCase() === decodedNip05.toLowerCase()) {
              console.log('[NIP05ProfilePage] Found matching profile:', event.pubkey);
              foundPubkey = event.pubkey;
              break;
            }
          } catch {
            // Skip malformed profiles
            continue;
          }
        }
        
        if (foundPubkey) {
          setPubkey(foundPubkey);
        } else {
          console.log('[NIP05ProfilePage] No profile found with NIP-05:', decodedNip05);
          setError(`No profile found with NIP-05: ${decodedNip05}`);
        }
      } catch (err) {
        console.error('[NIP05ProfilePage] Error searching for NIP-05:', err);
        setError(`Failed to search for ${nip05Param}. Please try again.`);
      } finally {
        setLoading(false);
      }
    }

    resolveNIP05();
  }, [nip05Param, nostr]);

  // Loading state
  if (loading) {
    return (
      <div className="container py-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="mx-auto h-20 w-20 rounded-[28px]" />
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto" />
              <div className="text-center text-muted-foreground">
                Resolving {nip05Param}...
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !pubkey) {
    return (
      <div className="container py-6">
        <Card className="max-w-2xl mx-auto border-destructive/50">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-destructive">
                Profile Not Found
              </h2>
              <p className="text-muted-foreground">
                {error || `Could not resolve ${nip05Param}`}
              </p>
              <p className="text-sm text-muted-foreground">
                Please check the address and try again
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Convert pubkey to npub for ProfilePage
  const npub = nip19.npubEncode(pubkey);
  
  // Redirect to the npub URL (ProfilePage will handle the display)
  return <Navigate to={`/${npub}`} replace />;
}

export default NIP05ProfilePage;
