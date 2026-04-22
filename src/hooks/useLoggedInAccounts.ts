import { useNostr } from '@nostrify/react';
import { useNostrLogin } from '@nostrify/react/login';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { NSchema as n, NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { createUserFromLogin } from '@/lib/nostrLogin';
import { useCurrentUser } from './useCurrentUser';
import { useDivineSession } from './useDivineSession';
import { useNip07Availability } from './useNip07Availability';

export interface Account {
  id: string;
  pubkey: string;
  event?: NostrEvent;
  metadata: NostrMetadata;
}

export function useLoggedInAccounts() {
  const { nostr } = useNostr();
  const { logins, setLogin, removeLogin } = useNostrLogin();
  const { getValidToken } = useDivineSession();
  const { metadata, user } = useCurrentUser();
  const token = getValidToken();
  const hasExtensionLogin = useMemo(() => (
    logins.some((login) => login.type === 'extension')
  ), [logins]);
  const isNip07Available = useNip07Availability(hasExtensionLogin);
  const activeLogins = useMemo(
    () => logins.filter((login) => {
      if (login.type === 'extension' && !isNip07Available) {
        return false;
      }

      try {
        createUserFromLogin(login, nostr);
        return true;
      } catch {
        return false;
      }
    }),
    [isNip07Available, logins, nostr],
  );

  const jwtCurrentUser = useMemo<Account | undefined>(() => {
    if (!token || !user) {
      return undefined;
    }

    return {
      id: `jwt:${user.pubkey}`,
      metadata: metadata ?? {},
      pubkey: user.pubkey,
    };
  }, [metadata, token, user]);

  const { data: authors = [] } = useQuery({
    queryKey: ['logins', activeLogins.map((l) => l.id).join(';')],
    queryFn: async ({ signal }) => {
      if (!activeLogins.length) {
        return [];
      }

      const events = await nostr.query(
        [{ kinds: [0], authors: activeLogins.map((l) => l.pubkey) }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) },
      );

      return activeLogins.map(({ id, pubkey }): Account => {
        const event = events.find((e) => e.pubkey === pubkey);
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event?.content);
          return { id, pubkey, metadata, event };
        } catch {
          return { id, pubkey, metadata: {}, event };
        }
      });
    },
    enabled: !jwtCurrentUser && activeLogins.length > 0,
    retry: 3,
  });

  if (jwtCurrentUser) {
    return {
      authors: [jwtCurrentUser],
      currentUser: jwtCurrentUser,
      otherUsers: [],
      setLogin,
      removeLogin,
    };
  }

  // Current user is the first login
  const currentUser: Account | undefined = (() => {
    const login = activeLogins[0];
    if (!login) return undefined;
    const author = authors.find((a) => a.id === login.id);
    return { metadata: {}, ...author, id: login.id, pubkey: login.pubkey };
  })();

  // Other users are all logins except the current one
  const otherUsers = (authors || []).slice(1) as Account[];

  return {
    authors,
    currentUser,
    otherUsers,
    setLogin,
    removeLogin,
  };
}
