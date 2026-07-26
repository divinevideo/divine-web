import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const VIDEO_SURFACES = [
  'src/components/VideoCard.tsx',
  'src/components/FullscreenVideoItem.tsx',
];

describe('support-only messaging entry points', () => {
  it.each(VIDEO_SURFACES)('%s does not offer private video DMs', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');

    expect(source).not.toContain('sendViaMessage');
    expect(source).not.toContain('buildDmShareQueryString');
    expect(source).not.toContain('buildDmSharePayloadFromVideo');
  });
});
