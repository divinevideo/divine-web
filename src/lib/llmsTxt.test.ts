import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('public llms.txt', () => {
  // vitest pins cwd to the project root; import.meta.url is not a file: URL
  // under the jsdom environment, so cwd-relative is the reliable option here.
  const llmsTxt = readFileSync(join(process.cwd(), 'public/llms.txt'), 'utf8');

  it('describes divine.video for end-user agents', () => {
    expect(llmsTxt).toMatch(/^# diVine$/m);
    expect(llmsTxt).toContain('human-made, decentralized short-form video');
    expect(llmsTxt).toContain('not for generating or posting AI-made videos');
  });

  it('keeps the required sections and freshness marker', () => {
    expect(llmsTxt).toMatch(/^## User Resources$/m);
    expect(llmsTxt).toMatch(/^## Developer Resources$/m);
    expect(llmsTxt).toMatch(/^## Optional$/m);
    expect(llmsTxt).toMatch(/^Last updated: \d{4}-\d{2}-\d{2}$/m);
  });

  it('states current availability without overselling the mobile betas', () => {
    expect(llmsTxt).toContain('The web app is publicly available.');
    expect(llmsTxt).toContain('iOS and Android betas are invite-only');
  });

  it('points agents at user-facing resources and public protocol docs', () => {
    expect(llmsTxt).toContain('[Home](https://divine.video/)');
    expect(llmsTxt).toContain('[Safety](https://divine.video/safety)');
    expect(llmsTxt).toContain('[Privacy Policy](https://divine.video/privacy)');
    expect(llmsTxt).toContain('[Terms of Service](https://divine.video/terms)');
    expect(llmsTxt).toContain('[FunnelCake API agent guide](https://api.divine.video/docs/llm-guide.md)');
  });
});
