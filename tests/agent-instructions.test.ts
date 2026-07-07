import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('agent instructions', () => {
  it('do not require a local AI acknowledgement gate', () => {
    expect(read('AGENTS.md')).not.toMatch(/\.ai-ack|AI Acknowledgment/);
    expect(read('HUMAN_VS_MACHINE.md')).not.toMatch(/\.ai-ack|yes i understood/);
    expect(read('.gitignore')).not.toMatch(/^\.ai-ack$/m);
  });

  it('use tool-neutral AI attribution guidance', () => {
    const agents = read('AGENTS.md');

    expect(agents).toContain('Do not add AI co-author trailers unless explicitly requested.');
    expect(agents).not.toContain('Co-Authored-By: Claude Opus');
  });

  it('does not publish Claude Code as active shared skill metadata', () => {
    expect(read('.agents/skills/spa-subdomain-root-render/SKILL.md')).not.toMatch(
      /^author: Claude Code$/m,
    );
  });
});
