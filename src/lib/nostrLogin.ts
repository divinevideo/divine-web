import type { NostrSigner } from '@nostrify/nostrify';
import { NUser, type NLoginType } from '@nostrify/react/login';
import { bunkerSignerFromLogin } from '@/lib/bunkerSigner';

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

export function createUserFromLogin(login: NLoginType): NUser {
  switch (login.type) {
    case 'nsec':
      return NUser.fromNsecLogin(login);
    case 'bunker':
      // Not NUser.fromBunkerLogin: that builds a signer which treats a NIP-46
      // auth challenge as a fatal error, so a signer that asks for approval
      // mid-session breaks every subsequent request (divine-web#485).
      return new NUser('bunker', login.pubkey, bunkerSignerFromLogin(login.data));
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
