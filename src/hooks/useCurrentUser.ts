import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { useNostr } from '@nostrify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NostrSigner } from '@nostrify/nostrify';
import { DivineJWTSigner } from '@/lib/DivineJWTSigner';
import { createUserFromLogin, getSafeUserSigner } from '@/lib/nostrLogin';
import { selectCurrentUsers, isJwtResolving } from '@/lib/selectCurrentUsers';

import { useAuthor } from './useAuthor.ts';
import { useDivineSession } from './useDivineSession';

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
  const [jwtError, setJwtError] = useState(false);
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
      setJwtError(false);
      return;
    }

    setJwtPubkey(undefined);
    setJwtError(false);

    jwtSigner.getPublicKey()
      .then((pubkey) => {
        if (!isCancelled) {
          setJwtPubkey(pubkey);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          console.warn('Skipped invalid JWT session', error);
          setJwtError(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [jwtSigner]);

  const manualUsers = useMemo(() => {
    const users: CurrentUser[] = [];

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

  const jwtUser = useMemo<CurrentUser | undefined>(() => {
    if (!jwtSigner || !jwtPubkey) {
      return undefined;
    }

    return {
      pubkey: jwtPubkey,
      signer: jwtSigner,
    };
  }, [jwtPubkey, jwtSigner]);

  const users = useMemo(
    () => selectCurrentUsers({ hasToken: !!token, jwtUser, jwtError, manualUsers }),
    [token, jwtUser, jwtError, manualUsers],
  );

  const isResolvingJwt = isJwtResolving({
    hasSigner: !!jwtSigner,
    jwtPubkey,
    jwtError,
  });

  const user = users[0];
  const signer = useMemo(() => getSafeUserSigner(user), [user]);
  const author = useAuthor(user?.pubkey);

  return {
    user,
    users,
    signer,
    isResolvingJwt,
    ...author.data,
  };
}
