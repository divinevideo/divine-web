import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const expectedArtifact = 'src/generated/productAnalytics.ts';

export function readEmbeddedCommit(contents) {
  return contents.match(/Source contract commit: ([0-9a-f]{40})/)?.[1];
}

export function assertContractPin(lock, artifact) {
  if (lock.artifact !== expectedArtifact) {
    throw new Error(`analytics contract lock must target ${expectedArtifact}`);
  }

  const bytes = Buffer.isBuffer(artifact) ? artifact : Buffer.from(artifact, 'utf8');
  const actualSha = createHash('sha256').update(bytes).digest('hex');
  if (actualSha !== lock.artifact_sha256) {
    throw new Error(
      `analytics contract artifact checksum drifted: expected ${lock.artifact_sha256}, got ${actualSha}`,
    );
  }

  const contents = bytes.toString('utf8');
  if (readEmbeddedCommit(contents) !== lock.contract_commit) {
    throw new Error('analytics contract artifact commit does not match the lock');
  }

  if (!contents.includes('DO NOT EDIT')) {
    throw new Error('analytics contract artifact is missing its generated-file header');
  }

  return lock.contract_commit;
}

export function verifyAnalyticsContract(root = repoRoot) {
  const lock = JSON.parse(readFileSync(join(root, 'analytics-contract.lock'), 'utf8'));

  return assertContractPin(lock, readFileSync(join(root, expectedArtifact)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`analytics contract pin verified at ${verifyAnalyticsContract()}`);
}
