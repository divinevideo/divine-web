import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { describe, it, expect } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.ts', '.tsx', '.css'].includes(extname(p))) out.push(p);
  }
  return out;
}

const FORBIDDEN = [
  /bg-gradient-/,
  /radial-gradient\(/,
  /linear-gradient\(/,
];

// Files where gradients are intentional (decorative illustration/imagery, not flat layout).
// Brand spec permits gradients INSIDE illustration components; forbids them on layout surfaces.
// Keep this list audited — anything added here must be a real illustration, not a layout escape hatch.
const ALLOWLIST: RegExp[] = [
  /src\/components\/ui\/avatar\.tsx$/,
  /src\/components\/BadgeImage\.tsx$/,
  /src\/components\/BadgeDetailModal\.tsx$/,
  /src\/components\/landing\/VerifiedDemo\.tsx$/,
  /src\/components\/landing\/DecentralizedDemo\.tsx$/,
];

// Phase 5: enforced. LandingPage, MessagesPage, ConversationPage, NotFound.tsx,
// VideoGrid, VideoFeed, HashtagExplorer, and ClassicVinersRow are now de-gradiented.
// Any new layout-surface gradient must either (a) be removed or (b) be justified
// as genuine illustration/imagery and added to ALLOWLIST with a code comment.
describe('brand rule: no gradients on layout surfaces', () => {
  it('src/ has no gradient classes or CSS gradients outside the illustration allowlist', () => {
    const files = walk('src');
    const violations: string[] = [];
    for (const f of files) {
      if (ALLOWLIST.some(r => r.test(f))) continue;
      const content = readFileSync(f, 'utf8');
      for (const re of FORBIDDEN) {
        if (re.test(content)) violations.push(`${f} matches ${re}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
