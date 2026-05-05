import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { useNostr } from '@nostrify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NostrSigner } from '@nostrify/nostrify';
import { DivineJWTSigner } from '@/lib/DivineJWTSigner';
import { createUserFromLogin, getSafeUserSigner } from '@/lib/nostrLogin';

import { useAuthor } from './useAuthor.ts';
import { useDivineSession } from './useDivineSession';
import { useNip07Availability } from './useNip07Availability';

type CurrentUser = {
  pubkey: string;
  signer?: NostrSigner;
};

export function useCurrentUser() {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();
  const { getValidToken } = useDivineSession();
  const token = getValidToken();
  const [jwtPubkey, setJwtPubkey] = useState<string>();
  const hasExtensionLogin = useMemo(() => (
    logins.some((login) => login.type === 'extension')
  ), [logins]);
  const { isAvailable: isNip07Available, isRestoring: isNip07Restoring } = useNip07Availability(hasExtensionLogin);
  const isAuthRestoring = hasExtensionLogin && isNip07Restoring;
  const jwtSigner = useMemo(() => (
    token ? new DivineJWTSigner({ token }) : null
  ), [token]);

  const loginToUser = useCallback((login: NLoginType): NUser  => {
    return createUserFromLogin(login, nostr);
  }, [nostr]);

  useEffect(() => {
    let isCancelled = false;

    if (!jwtSigner) {
      setJwtPubkey(undefined);
      return;
    }

    setJwtPubkey(undefined);

    jwtSigner.getPublicKey()
      .then((pubkey) => {
        if (!isCancelled) {
          setJwtPubkey(pubkey);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          console.warn('Skipped invalid JWT session', error);
          setJwtPubkey(undefined);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [jwtSigner]);

  const manualUsers = useMemo(() => {
    const users: CurrentUser[] = [];

    for (const login of logins) {
      if (login.type === 'extension' && !isNip07Available) {
        users.push({ pubkey: login.pubkey });
        continue;
      }

      try {
        const user = loginToUser(login);
        users.push(user);
      } catch (error) {
        console.warn('Skipped invalid login', login.id, error);
      }
    }

    return users;
  }, [isNip07Available, logins, loginToUser]);

  const jwtUser = useMemo<CurrentUser | undefined>(() => {
    if (!jwtSigner || !jwtPubkey) {
      return undefined;
    }

    return {
      pubkey: jwtPubkey,
      signer: jwtSigner,
    };
  }, [jwtPubkey, jwtSigner]);

  const users = useMemo(() => (
    token ? (jwtUser ? [jwtUser] : []) : manualUsers
  ), [jwtUser, manualUsers, token]);

  const user = users[0];
  const signer = useMemo(() => getSafeUserSigner(user), [user]);
  const author = useAuthor(user?.pubkey);

  return {
    user,
    users,
    signer,
    isAuthRestoring,
    ...author.data,
  };
}
