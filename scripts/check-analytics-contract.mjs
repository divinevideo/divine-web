import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const expectedArtifact = 'src/generated/productAnalytics.ts';
const expectedManifest = 'analytics-contract.manifest.json';
const expectedSourceArtifact = 'analytics/generated/productAnalytics.ts';
const expectedSourceManifest = 'analytics/generated/manifest.json';
const expectedLockKeys = [
  'artifact',
  'artifact_commit',
  'artifact_sha256',
  'contract_commit',
  'manifest',
  'manifest_sha256',
  'schema_version',
  'source_artifact',
  'source_manifest',
];

export function readEmbeddedCommit(contents) {
  return contents.match(/Source contract commit: ([0-9a-f]{40})/)?.[1];
}

export function readEmbeddedSchemaVersion(contents) {
  const match = contents.match(
    /PRODUCT_ANALYTICS_V([0-9]+)_SCHEMA_VERSION = ([0-9]+) as const;/,
  );

  return match?.[1] === match?.[2] ? Number(match[1]) : undefined;
}

export function readEmbeddedEventIdAlgorithm(contents) {
  return contents.match(/PRODUCT_ANALYTICS_V2_EVENT_ID_ALGORITHM = '([^']+)' as const;/)?.[1];
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`analytics contract ${label} must be ${expected}`);
  }
}

function requireMatch(value, pattern, label) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`analytics contract ${label} has an invalid format`);
  }
}

function asBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
}

export function assertContractPin(lock, artifact, manifest) {
  if (JSON.stringify(Object.keys(lock).sort()) !== JSON.stringify(expectedLockKeys)) {
    throw new Error('analytics contract lock fields do not match the required provenance fields');
  }
  if (lock.artifact !== expectedArtifact) {
    throw new Error(`analytics contract lock must target ${expectedArtifact}`);
  }

  requireEqual(lock.manifest, expectedManifest, 'manifest path');
  requireEqual(lock.source_artifact, expectedSourceArtifact, 'source artifact path');
  requireEqual(lock.source_manifest, expectedSourceManifest, 'source manifest path');
  requireEqual(lock.schema_version, 2, 'schema version');
  requireMatch(lock.contract_commit, /^[0-9a-f]{40}$/, 'contract commit');
  requireMatch(lock.artifact_commit, /^[0-9a-f]{40}$/, 'artifact commit');
  requireMatch(lock.artifact_sha256, /^[0-9a-f]{64}$/, 'artifact checksum');
  requireMatch(lock.manifest_sha256, /^[0-9a-f]{64}$/, 'manifest checksum');

  const manifestBytes = asBuffer(manifest);
  const actualManifestSha = createHash('sha256').update(manifestBytes).digest('hex');
  if (actualManifestSha !== lock.manifest_sha256) {
    throw new Error(
      `analytics contract manifest checksum drifted: expected ${lock.manifest_sha256}, got ${actualManifestSha}`,
    );
  }
  const manifestValue = JSON.parse(manifestBytes.toString('utf8'));
  requireEqual(manifestValue.contract_commit, lock.contract_commit, 'manifest commit');
  requireEqual(manifestValue.schema_version, lock.schema_version, 'manifest schema version');
  requireEqual(
    manifestValue.event_id_algorithm,
    'sha256-rfc8785-v1',
    'manifest event ID algorithm',
  );
  const sourceName = expectedSourceArtifact.split('/').at(-1);
  const sourceEntry = manifestValue.artifacts?.[sourceName];
  if (sourceEntry === null || typeof sourceEntry !== 'object' || Array.isArray(sourceEntry)) {
    throw new Error('analytics contract source artifact is missing from the manifest');
  }
  requireEqual(sourceEntry.path, expectedSourceArtifact, 'manifest artifact path');
  requireEqual(sourceEntry.sha256, lock.artifact_sha256, 'manifest artifact checksum');

  const artifactBytes = asBuffer(artifact);
  const actualArtifactSha = createHash('sha256').update(artifactBytes).digest('hex');
  if (actualArtifactSha !== lock.artifact_sha256) {
    throw new Error(
      `analytics contract artifact checksum drifted: expected ${lock.artifact_sha256}, got ${actualArtifactSha}`,
    );
  }

  const contents = artifactBytes.toString('utf8');
  if (readEmbeddedCommit(contents) !== lock.contract_commit) {
    throw new Error('analytics contract artifact commit does not match the lock');
  }
  const embeddedSchemaVersion = readEmbeddedSchemaVersion(contents);
  if (embeddedSchemaVersion !== lock.schema_version) {
    throw new Error(
      `analytics contract schema version does not match the lock: expected ${lock.schema_version}, got ${embeddedSchemaVersion}`,
    );
  }
  if (readEmbeddedEventIdAlgorithm(contents) !== 'sha256-rfc8785-v1') {
    throw new Error('analytics contract event ID algorithm does not match the manifest');
  }
  if (!contents.includes('DO NOT EDIT')) {
    throw new Error('analytics contract artifact is missing its generated-file header');
  }

  return lock.contract_commit;
}

export function verifyAnalyticsContract(root = repoRoot) {
  const lock = JSON.parse(readFileSync(join(root, 'analytics-contract.lock'), 'utf8'));
  const artifact = readFileSync(join(root, expectedArtifact));
  const manifest = readFileSync(join(root, expectedManifest));

  assertContractPin(lock, artifact, manifest);
  return lock;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lock = verifyAnalyticsContract();
  console.log(
    `analytics contract pin verified at ${lock.contract_commit} from artifact ${lock.artifact_commit}`,
  );
}
