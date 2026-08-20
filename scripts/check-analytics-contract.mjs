import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lock = JSON.parse(readFileSync(join(repoRoot, 'analytics-contract.lock'), 'utf8'));
const expectedArtifact = 'src/generated/productAnalytics.ts';

if (lock.artifact !== expectedArtifact) {
  throw new Error(`analytics contract lock must target ${expectedArtifact}`);
}

const artifact = readFileSync(join(repoRoot, expectedArtifact));
const actualSha = createHash('sha256').update(artifact).digest('hex');
if (actualSha !== lock.artifact_sha256) {
  throw new Error(
    `analytics contract artifact checksum drifted: expected ${lock.artifact_sha256}, got ${actualSha}`,
  );
}

const contents = artifact.toString('utf8');
const embeddedCommit = contents.match(/Source contract commit: ([0-9a-f]{40})/)?.[1];
if (embeddedCommit !== lock.contract_commit) {
  throw new Error('analytics contract artifact commit does not match the lock');
}
if (!contents.includes('DO NOT EDIT')) {
  throw new Error('analytics contract artifact is missing its generated-file header');
}

console.log(`analytics contract pin verified at ${lock.contract_commit}`);
