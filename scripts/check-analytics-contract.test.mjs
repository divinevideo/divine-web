import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  assertContractPin,
  readEmbeddedCommit,
  readEmbeddedEventIdAlgorithm,
  readEmbeddedSchemaVersion,
  verifyAnalyticsContract,
} from './check-analytics-contract.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lock = JSON.parse(readFileSync(join(repoRoot, 'analytics-contract.lock'), 'utf8'));
const artifact = readFileSync(join(repoRoot, 'src/generated/productAnalytics.ts'));
const manifest = readFileSync(join(repoRoot, 'analytics-contract.manifest.json'));

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function repinManifest(manifestValue, lockOverrides = {}) {
  const repinnedManifest = Buffer.from(`${JSON.stringify(manifestValue, null, 2)}\n`);
  return {
    lock: {
      ...lock,
      ...lockOverrides,
      manifest_sha256: sha256(repinnedManifest),
    },
    manifest: repinnedManifest,
  };
}

function repinArtifact(repinnedArtifact) {
  const artifactSha = sha256(repinnedArtifact);
  const manifestValue = JSON.parse(manifest.toString('utf8'));
  manifestValue.artifacts['productAnalytics.ts'].sha256 = artifactSha;
  return repinManifest(manifestValue, { artifact_sha256: artifactSha });
}

describe('analytics contract pin', () => {
  it('accepts the checked-in artifact and lock', () => {
    expect(verifyAnalyticsContract()).toEqual(lock);
  });

  it('reads the commit, schema version, and ID algorithm the generator embedded', () => {
    const contents = artifact.toString('utf8');

    expect(readEmbeddedCommit(contents)).toBe(lock.contract_commit);
    expect(readEmbeddedSchemaVersion(contents)).toBe(lock.schema_version);
    expect(readEmbeddedEventIdAlgorithm(contents)).toBe('sha256-rfc8785-v1');
    expect(contents).toContain('DO NOT EDIT');
  });

  it('rejects a lock that points at another file', () => {
    expect(() =>
      assertContractPin({ ...lock, artifact: 'src/generated/other.ts' }, artifact, manifest),
    )
      .toThrow(/must target/);
  });

  it('rejects an artifact edited after it was pinned', () => {
    const edited = Buffer.concat([artifact, Buffer.from('\nexport const SNUCK_IN = 1;\n')]);

    expect(() => assertContractPin(lock, edited, manifest)).toThrow(/checksum drifted/);
  });

  it('rejects a re-pin that forgot to update the contract commit', () => {
    const contractCommit = 'a'.repeat(40);
    const manifestValue = JSON.parse(manifest.toString('utf8'));
    manifestValue.contract_commit = contractCommit;
    const repinned = repinManifest(manifestValue, { contract_commit: contractCommit });

    expect(() => assertContractPin(repinned.lock, artifact, repinned.manifest))
      .toThrow(/artifact commit does not match/);
  });

  it('rejects a re-pin that forgot to update the schema version', () => {
    expect(() => assertContractPin({ ...lock, schema_version: 1 }, artifact, manifest))
      .toThrow(/schema version/);
  });

  it('rejects a modified upstream manifest', () => {
    const edited = Buffer.concat([manifest, Buffer.from('\n')]);

    expect(() => assertContractPin(lock, artifact, edited)).toThrow(/manifest checksum drifted/);
  });

  it('rejects a manifest with another event ID algorithm', () => {
    const manifestValue = JSON.parse(manifest.toString('utf8'));
    manifestValue.event_id_algorithm = 'random-uuid';
    const repinned = repinManifest(manifestValue);

    expect(() => assertContractPin(repinned.lock, artifact, repinned.manifest))
      .toThrow(/event ID algorithm/);
  });

  it('rejects an artifact with another event ID algorithm', () => {
    const edited = Buffer.from(
      artifact.toString('utf8').replace('sha256-rfc8785-v1', 'random-uuid'),
      'utf8',
    );
    const repinned = repinArtifact(edited);

    expect(() => assertContractPin(repinned.lock, edited, repinned.manifest))
      .toThrow(/event ID algorithm/);
  });

  it('rejects an artifact commit that is not a full Git commit', () => {
    expect(() => assertContractPin({ ...lock, artifact_commit: 'branch-name' }, artifact, manifest))
      .toThrow(/artifact commit has an invalid format/);
  });

  it('rejects unvalidated lock fields', () => {
    expect(() => assertContractPin({ ...lock, unused: true }, artifact, manifest))
      .toThrow(/required provenance fields/);
  });

  it('rejects an artifact whose schema version constant was renamed', () => {
    const renamed = Buffer.from(
      artifact
        .toString('utf8')
        .replace('PRODUCT_ANALYTICS_V2_SCHEMA_VERSION', 'PRODUCT_ANALYTICS_SCHEMA_REVISION'),
      'utf8',
    );
    const repinned = repinArtifact(renamed);

    expect(() => assertContractPin(repinned.lock, renamed, repinned.manifest))
      .toThrow(/schema version does not match the lock/);
  });

  it('rejects an artifact missing its generated-file header', () => {
    const stripped = Buffer.from(artifact.toString('utf8').replace('// DO NOT EDIT.', '//'), 'utf8');
    const repinned = repinArtifact(stripped);

    expect(() => assertContractPin(repinned.lock, stripped, repinned.manifest))
      .toThrow(/generated-file header/);
  });
});
