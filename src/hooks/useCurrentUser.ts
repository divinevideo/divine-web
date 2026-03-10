import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { useNostr } from '@nostrify/react';
import { useCallback, useMemo } from 'react';
import { createUserFromLogin, getSafeUserSigner } from '@/lib/nostrLogin';

import { useAuthor } from './useAuthor.ts';

export function useCurrentUser() {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();

  const loginToUser = useCallback((login: NLoginType): NUser  => {
    return createUserFromLogin(login, nostr);
  }, [nostr]);

  const users = useMemo(() => {
    const users: NUser[] = [];

    for (const login of logins) {
      try {
        const user = loginToUser(login);
        users.push(user);
      } catch (error) {
        console.warn('Skipped invalid login', login.id, error);
      }
    }

    return users;
  }, [logins, loginToUser]);

  const user = users[0] as NUser | undefined;
  const signer = useMemo(() => getSafeUserSigner(user), [user]);
  const author = useAuthor(user?.pubkey);

  return {
    user,
    users,
    signer,
    ...author.data,
  };
}
