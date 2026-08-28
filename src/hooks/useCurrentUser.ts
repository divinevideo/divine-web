import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NostrSigner } from '@nostrify/nostrify';
import { DivineJWTSigner } from '@/lib/DivineJWTSigner';
import { createUserFromLogin, getSafeUserSigner } from '@/lib/nostrLogin';
import { releaseBunkerSignersExcept } from '@/lib/bunkerSignerRegistry';
import { selectCurrentUsers, isJwtResolving } from '@/lib/selectCurrentUsers';

import { useAuthor } from './useAuthor.ts';
import { useDivineSession } from './useDivineSession';
import { useNip07Availability } from './useNip07Availability';

type CurrentUser = {
  pubkey: string;
  signer?: NostrSigner;
};

// The result of resolving a hosted-JWT signer, tagged with the token it belongs
// to. Tagging lets us ignore a resolution from a previous token after a swap, so
// we never pair a stale pubkey (or stale error) with the current signer.
type JwtResolution =
  | { token: string; pubkey: string }
  | { token: string; error: true };

export function useCurrentUser() {
  const { logins } = useNostrLogin();
  const { getValidToken, isExpired } = useDivineSession();
  const token = getValidToken();
  const [jwtResolution, setJwtResolution] = useState<JwtResolution>();
  const jwtSigner = useMemo(() => (
    token ? new DivineJWTSigner({ token }) : null
  ), [token]);

  const loginToUser = useCallback((login: NLoginType): NUser  => {
    return createUserFromLogin(login);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!jwtSigner || !token) {
      return;
    }

    jwtSigner.getPublicKey()
      .then((pubkey) => {
        if (!isCancelled) {
          setJwtResolution({ token, pubkey });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          console.warn('Skipped invalid JWT session', error);
          setJwtResolution({ token, error: true });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [jwtSigner, token]);

  // Only honor a resolution that belongs to the CURRENT token. After a token
  // swap, the prior resolution is ignored (both pubkey and error), so the new
  // signer reads as "resolving" rather than briefly pairing with stale data.
  const jwtPubkey =
    jwtResolution && jwtResolution.token === token && 'pubkey' in jwtResolution
      ? jwtResolution.pubkey
      : undefined;
  const jwtError =
    !!jwtResolution && jwtResolution.token === token && 'error' in jwtResolution;

  const hasExtensionLogin = logins.some((login) => login.type === 'extension');
  const nip07Status = useNip07Availability(hasExtensionLogin);

  const loginIds = logins.map((login) => login.id).join(';');

  // A removed login's signer is the last thing holding its sockets open.
  // Reconciling against the surviving ids covers every logout path, including
  // account switching and a login dropped as invalid.
  useEffect(() => {
    releaseBunkerSignersExcept(loginIds ? loginIds.split(';') : []);
  }, [loginIds]);

  const manualUsers = useMemo(() => {
    const users: CurrentUser[] = [];

    for (const login of logins) {
      // Extension content scripts can inject window.nostr after first render;
      // hold off on extension logins until the availability check settles.
      if (login.type === 'extension' && nip07Status === 'checking') {
        continue;
      }

      try {
        const user = loginToUser(login);
        users.push(user);
      } catch (error) {
        if (login.type === 'extension' && nip07Status === 'unavailable') {
          // Expected when the extension was removed or disabled. Sentry
          // captures console.warn, so keep this at info to avoid alert noise.
          console.info('Skipped extension login; no NIP-07 provider found', login.id);
        } else {
          console.warn('Skipped invalid login', login.id, error);
        }
      }
    }

    return users;
  }, [logins, loginToUser, nip07Status]);

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
  const isHostedAccount = !!user?.pubkey && user.pubkey === jwtPubkey;
  const hostedToken = !isExpired && isHostedAccount ? token : null;

  return {
    user,
    users,
    signer,
    hostedToken,
    isHostedAccount,
    isResolvingJwt,
    ...author.data,
  };
}
