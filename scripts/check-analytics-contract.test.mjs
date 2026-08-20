import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  assertContractPin,
  readEmbeddedCommit,
  verifyAnalyticsContract,
} from './check-analytics-contract.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lock = JSON.parse(readFileSync(join(repoRoot, 'analytics-contract.lock'), 'utf8'));
const artifact = readFileSync(join(repoRoot, 'src/generated/productAnalytics.ts'));

describe('analytics contract pin', () => {
  it('accepts the checked-in artifact and lock', () => {
    expect(verifyAnalyticsContract()).toBe(lock.contract_commit);
  });

  it('reads the commit the generator embedded', () => {
    const contents = artifact.toString('utf8');

    expect(readEmbeddedCommit(contents)).toBe(lock.contract_commit);
    expect(contents).toContain('DO NOT EDIT');
  });

  it('rejects a lock that points at another file', () => {
    expect(() => assertContractPin({ ...lock, artifact: 'src/generated/other.ts' }, artifact))
      .toThrow(/must target/);
  });

  it('rejects an artifact edited after it was pinned', () => {
    const edited = Buffer.concat([artifact, Buffer.from('\nexport const SNUCK_IN = 1;\n')]);

    expect(() => assertContractPin(lock, edited)).toThrow(/checksum drifted/);
  });

  it('rejects a re-pin that forgot to update the contract commit', () => {
    expect(() => assertContractPin({ ...lock, contract_commit: 'a'.repeat(40) }, artifact))
      .toThrow(/commit does not match/);
  });

  it('rejects an artifact missing its generated-file header', () => {
    const stripped = Buffer.from(artifact.toString('utf8').replace('// DO NOT EDIT.', '//'), 'utf8');
    const repinned = {
      ...lock,
      artifact_sha256: createHash('sha256').update(stripped).digest('hex'),
    };

    expect(() => assertContractPin(repinned, stripped)).toThrow(/generated-file header/);
  });
});
