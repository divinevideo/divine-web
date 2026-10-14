// ABOUTME: Subtitle for a DM conversation header - a NIP-05 address or an @handle.
// ABOUTME: Handle surface, so it stays name-only and never falls back to display_name.

import { DIVINE_SUPPORT_PUBKEY } from '@/lib/dm';
import { genUserName } from '@/lib/genUserName';
import { getDivineNip05Info } from '@/lib/nip05Utils';

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Build the conversation subtitle shown under a peer's name.
 *
 * Deliberately ignores display_name: the result is rendered behind an `@`, and a
 * handle of `@Some Display Name` is neither valid nor actionable. An absent name
 * falls through to the generated name, which is handle-shaped.
 */
export function getConversationSubtitle(
  pubkey: string,
  metadata?: { display_name?: string; name?: string; nip05?: string },
  translate?: Translate,
): string {
  if (pubkey === DIVINE_SUPPORT_PUBKEY) {
    return translate
      ? translate('conversationPage.privateSupportChat')
      : 'Private support chat';
  }

  const nip05 = metadata?.nip05?.trim();
  if (nip05) {
    const divineInfo = getDivineNip05Info(nip05);
    if (divineInfo) {
      return divineInfo.displayName;
    }

    return nip05.startsWith('_@') ? `@${nip05.slice(2)}` : `@${nip05}`;
  }

  return `@${metadata?.name || genUserName(pubkey)}`;
}
