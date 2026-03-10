import type { NostrSigner } from '@nostrify/nostrify';
import { NUser, type NLoginType } from '@nostrify/react/login';

type NostrClient = Parameters<typeof NUser.fromBunkerLogin>[1];

export function hasNip07Provider(): boolean {
  if (typeof window === 'undefined') return false;
  return 'nostr' in window;
}

export function getSafeUserSigner(
  user?: Pick<NUser, 'signer'> | null,
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

export function createUserFromLogin(login: NLoginType, nostr: NostrClient): NUser {
  switch (login.type) {
    case 'nsec':
      return NUser.fromNsecLogin(login);
    case 'bunker':
      return NUser.fromBunkerLogin(login, nostr);
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
