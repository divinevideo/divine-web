import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..');
const VIDEO_SURFACES = [
  'src/components/VideoCard.tsx',
  'src/components/FullscreenVideoItem.tsx',
];

describe('support-only messaging entry points', () => {
  it.each(VIDEO_SURFACES)('%s does not offer private video DMs', (file) => {
    const source = readFileSync(resolve(REPO_ROOT, file), 'utf8');

    expect(source).not.toContain('sendViaMessage');
    expect(source).not.toContain('buildDmShareQueryString');
    expect(source).not.toContain('buildDmSharePayloadFromVideo');
  });

  it('keeps the DM share path fully removed from the messaging stack', () => {
    for (const file of [
      'src/pages/ConversationPage.tsx',
      'src/hooks/useDirectMessages.ts',
      'src/lib/dm.ts',
    ]) {
      const source = readFileSync(resolve(REPO_ROOT, file), 'utf8');

      expect(source).not.toContain('useParsedDmShare');
      expect(source).not.toContain('parseDmShareQuery');
      expect(source).not.toContain('buildDmShareQueryString');
      expect(source).not.toContain('buildDmSharePayloadFromVideo');
      expect(source).not.toContain('buildDmShareTags');
    }
  });

  it('keeps the prerendered FAQ messaging accurate', () => {
    const source = readFileSync(
      resolve(REPO_ROOT, 'scripts/prerender-content/faq-content.html'),
      'utf8',
    ).replace(/\s+/g, ' ');

    expect(source).toContain('Private support messages');
    expect(source).toContain(
      "Divine's current private messaging channel is for contacting Divine Support.",
    );
    expect(source).toContain(
      'Messages use encrypted NIP-17 delivery, and the support team can read and respond to messages sent to that channel.',
    );
    expect(source).toContain(
      'User-to-user DMs and private video sharing are not available on Divine Web right now.',
    );
    expect(source).not.toContain('Direct messages ARE private');
    expect(source).not.toContain('direct messages between users are end-to-end encrypted');
  });
});
