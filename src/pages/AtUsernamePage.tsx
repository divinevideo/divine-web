// ABOUTME: Page for /@username routes (e.g., divine.video/@samuelgrubbs)
// ABOUTME: Checks edge-injected data first, then looks up username via KV/API and redirects to profile

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { Card, CardContent } from '@/components/ui/card';
import { WarningCircle as AlertCircle, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import ProfilePage from './ProfilePage';

/**
 * Look up a username via the Funnelcake API's NIP-05 resolution
 */
function useUsernameLookup(username: string | undefined) {
  // If edge worker already injected user data, skip the lookup
  const subdomainUser = getSubdomainUser();

  return useQuery({
    queryKey: ['at-username', username?.toLowerCase()],
    queryFn: async ({ signal }) => {
      if (!username) throw new Error('No username provided');
      const normalizedUsername = username.toLowerCase();

      // Look up username via NIP-05 resolution (divine.video/.well-known/nostr.json)
      const divineNip05 = await fetch(
        `https://divine.video/.well-known/nostr.json?name=${encodeURIComponent(normalizedUsername)}`,
        { signal }
      );
      if (divineNip05.ok) {
        const data = await divineNip05.json();
        const pubkey = data.names?.[normalizedUsername];
        if (pubkey) {
          return { pubkey, npub: nip19.npubEncode(pubkey) };
        }
      }

      throw new Error(`User @${username} not found`);
    },
    enabled: !!username && !subdomainUser,
    staleTime: 300000,
    gcTime: 600000,
    retry: 1,
  });
}

export function AtUsernamePage() {
  // Username comes from either /@:username route or /:nip19 catch-all (with @ prefix)
  const params = useParams<{ username?: string; nip19?: string }>();
  const username = params.username || params.nip19?.replace(/^@/, '');
  const navigate = useNavigate();
  const subdomainUser = getSubdomainUser();

  // All hooks must be called before any conditional returns
  const { data, isLoading, error } = useUsernameLookup(username);

  useEffect(() => {
    if (data?.npub) {
      navigate(`/profile/${data.npub}`, { replace: true });
    }
  }, [data, navigate]);

  // If edge worker injected the user data, render ProfilePage directly
  if (subdomainUser) {
    return <ProfilePage />;
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Looking up @{username}...</p>
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
                Could not find user
                <code className="text-sm bg-muted px-2 py-1 rounded ml-2">@{username}</code>
              </p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Try visiting their profile at{' '}
                <a
                  href={`https://${username}.divine.video`}
                  className="text-primary hover:underline"
                >
                  {username}.divine.video
                </a>
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
