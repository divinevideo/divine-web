import type { NostrSigner } from '@nostrify/nostrify';
import { NUser, type NLoginType } from '@nostrify/react/login';
import { getBunkerSigner, isUsableBunkerLogin } from '@/lib/bunkerSignerRegistry';

export function hasNip07Provider(): boolean {
  if (typeof window === 'undefined') return false;
  return 'nostr' in window;
}

export function getSafeUserSigner(
  user?: { signer?: NostrSigner } | null,
): NostrSigner | undefined {
  if (!user) {
    return undefined;
  }

  try {
    return user.signer;
  } catch {
    return undefined;
  }
}

/**
 * Whether `createUserFromLogin` would succeed, without building anything.
 *
 * A caller that only needs to know a login is usable must not go through
 * `createUserFromLogin`: for a bunker login that reaches the registry and, on
 * the first such call, opens the connection for a login that may never sign
 * anything.
 */
export function canCreateUserFromLogin(login: NLoginType): boolean {
  try {
    if (login.type === 'bunker') {
      return isUsableBunkerLogin(login.data);
    }

    createUserFromLogin(login);
    return true;
  } catch {
    return false;
  }
}

export function createUserFromLogin(login: NLoginType): NUser {
  switch (login.type) {
    case 'nsec':
      return NUser.fromNsecLogin(login);
    case 'bunker':
      // Not NUser.fromBunkerLogin: that builds a signer which treats a NIP-46
      // auth challenge as a fatal error, so a signer that asks for approval
      // mid-session breaks every subsequent request (divine-web#485).
      // Registry rather than a fresh signer: this runs in a `useMemo` in
      // `useCurrentUser`, so one per call meant one socket set per mounted
      // component, none of them ever closed (divine-web#531).
      return new NUser('bunker', login.pubkey, getBunkerSigner(login.id, login.data));
    case 'extension': {
      if (!hasNip07Provider()) {
        throw new Error('Browser extension not available');
      }

      const user = NUser.fromExtensionLogin(login);
      if (!getSafeUserSigner(user)) {
        throw new Error('Browser extension not available');
      }

      return user;
    }
    default:
      throw new Error(`Unsupported login type: ${login.type}`);
  }
}
