import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..');

function readPrerenderedPrivacy(): string {
  return readFileSync(resolve(REPO_ROOT, 'scripts/prerender-content/privacy-content.html'), 'utf8')
    .replace(/\s+/g, ' ');
}

describe('prerendered privacy policy', () => {
  it('discloses transcript translation in both versions of the policy', () => {
    const copies = [
      readPrerenderedPrivacy(),
      readFileSync(resolve(REPO_ROOT, 'src/pages/PrivacyPage.tsx'), 'utf8').replace(/\s+/g, ' '),
    ];

    for (const copy of copies) {
      expect(copy).toContain(
        "When a viewer requests subtitles in another language, Divine sends the video's transcript text to Google Cloud Translation to generate a machine translation.",
      );
      expect(copy).toContain('Divine stores the translated subtitles to serve later viewers.');
      expect(copy).toContain('Machine translations may contain errors; the original subtitles remain available.');
    }
  });

  it('keeps the Shorebird update-telemetry disclosure in the prerendered copy', () => {
    const source = readPrerenderedPrivacy();

    expect(source).toContain('Divine uses Shorebird to check for and deliver app updates.');
    expect(source).toContain(
      'The installation identifier is not an advertising identifier and is not used for advertising or cross-app tracking.',
    );
  });

  it('keeps the prerendered Shorebird disclosure aligned with the React privacy page', () => {
    const prerendered = readPrerenderedPrivacy();
    const page = readFileSync(resolve(REPO_ROOT, 'src/pages/PrivacyPage.tsx'), 'utf8')
      .replace(/\s+/g, ' ');

    const disclosureSentences = [
      'Divine uses Shorebird to check for and deliver app updates.',
      'Shorebird receives a random identifier unique to that app installation, the app, release, and patch versions, update channel, platform, device architecture, and patch download or installation status.',
      'This information is used to deliver updates, diagnose update failures, and produce aggregated update and active-install analytics.',
      'The installation identifier is not an advertising identifier and is not used for advertising or cross-app tracking.',
    ];

    for (const sentence of disclosureSentences) {
      expect(prerendered, `prerendered copy must contain: ${sentence}`).toContain(sentence);
      expect(page, `PrivacyPage copy must contain: ${sentence}`).toContain(sentence);
    }
  });
});
