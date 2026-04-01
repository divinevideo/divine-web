// ABOUTME: Resolves divine.video/@username to username.divine.video via NIP-05 lookup
// ABOUTME: Fetches /.well-known/nostr.json and redirects to the user's subdomain profile

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import { debugLog } from '@/lib/debug';

const HEX_64_PATTERN = /^[0-9a-f]{64}$/i;
const APEX_DOMAIN = 'divine.video';

function decodeUsername(raw: string): string {
  try {
    return decodeURIComponent(raw).toLowerCase().trim();
  } catch {
    return raw.toLowerCase().trim();
  }
}

function useNip05Lookup(username: string | undefined) {
  return useQuery({
    queryKey: ['at-username-nip05', username],
    queryFn: async ({ signal }) => {
      if (!username) throw new Error('No username');

      const decoded = decodeUsername(username);
      debugLog('[AtUsernamePage] Looking up NIP-05 for:', decoded);

      const response = await fetch(
        `/.well-known/nostr.json?name=${encodeURIComponent(decoded)}`,
        { signal },
      );

      if (!response.ok) {
        throw new Error(`NIP-05 lookup failed: ${response.status}`);
      }

      const data = await response.json();
      const pubkey = data?.names?.[decoded];

      if (!pubkey || typeof pubkey !== 'string' || !HEX_64_PATTERN.test(pubkey)) {
        throw new UserNotFoundError(decoded);
      }

      debugLog('[AtUsernamePage] Resolved:', decoded);
      return { username: decoded, pubkey };
    },
    enabled: !!username,
    staleTime: 300_000,
    gcTime: 600_000,
    retry: (failureCount, error) =>
      !(error instanceof UserNotFoundError) && failureCount < 2,
  });
}

class UserNotFoundError extends Error {}

interface AtUsernamePageProps {
  username: string;
}

export function AtUsernamePage({ username }: AtUsernamePageProps) {
  const navigate = useNavigate();
  const subdomainUser = getSubdomainUser();

  // On subdomains, NIP-05 serves the subdomain owner, not the ?name= query.
  // Redirect to the apex domain so the lookup resolves correctly.
  useEffect(() => {
    if (subdomainUser) {
      const decoded = decodeUsername(username);
      window.location.href = `https://${APEX_DOMAIN}/@${decoded}`;
    }
  }, [subdomainUser, username]);

  const { data, isLoading, error } = useNip05Lookup(subdomainUser ? undefined : username);

  useEffect(() => {
    if (data) {
      const href = `https://${data.username}.${APEX_DOMAIN}`;
      debugLog('[AtUsernamePage] Redirecting to:', href);
      window.location.href = href;
    }
  }, [data]);

  const decoded = decodeUsername(username);

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Looking up @{decoded}...
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
                Could not find a user with username:
                <code className="text-sm bg-muted px-2 py-1 rounded ml-2">@{decoded}</code>
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

  // Redirecting state
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Redirecting to {decoded}.{APEX_DOMAIN}...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
