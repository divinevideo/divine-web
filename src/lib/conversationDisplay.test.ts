import { describe, expect, it } from 'vitest';

import { getConversationSubtitle } from '@/lib/conversationDisplay';
import { genUserName } from '@/lib/genUserName';

const PUBKEY = 'b'.repeat(64);

describe('getConversationSubtitle', () => {
  it('keeps display_name out of a generated @handle when name and nip05 are absent', () => {
    expect(getConversationSubtitle(PUBKEY, {
      name: '',
      display_name: 'Display Name With Spaces',
    })).toBe(`@${genUserName(PUBKEY)}`);
  });
});
