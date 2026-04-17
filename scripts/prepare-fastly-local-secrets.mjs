import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const targetPath = path.join(repoRoot, 'compute-js', 'test-data', 'secrets.json');

function readEnv(name) {
  return process.env[name] ?? process.env[`FASTLY_LOCAL_${name}`] ?? '';
}

const secrets = {
  ZENDESK_SUBDOMAIN: readEnv('ZENDESK_SUBDOMAIN'),
  ZENDESK_API_EMAIL: readEnv('ZENDESK_API_EMAIL'),
  ZENDESK_API_TOKEN: readEnv('ZENDESK_API_TOKEN'),
};

const hasConfiguredSecrets = Object.values(secrets).every((value) => value.trim().length > 0);
const hasAnyConfiguredSecret = Object.values(secrets).some((value) => value.trim().length > 0);

mkdirSync(path.dirname(targetPath), { recursive: true });

if (existsSync(targetPath) && !hasAnyConfiguredSecret) {
  console.log(`Using existing local Fastly secrets file: ${targetPath}`);
  process.exit(0);
}

writeFileSync(targetPath, `${JSON.stringify(secrets, null, 2)}\n`, 'utf8');

if (hasConfiguredSecrets) {
  console.log(`Wrote local Fastly secrets file from environment: ${targetPath}`);
  process.exit(0);
}

if (hasAnyConfiguredSecret) {
  console.warn(
    'Local Fastly secrets file was written with partial Zendesk configuration. Missing values will cause /api/report to fail until all secrets are provided.',
  );
  process.exit(0);
}

console.warn(
  [
    `Created placeholder local Fastly secrets file: ${targetPath}`,
    'Set ZENDESK_SUBDOMAIN, ZENDESK_API_EMAIL, and ZENDESK_API_TOKEN',
    'or FASTLY_LOCAL_ZENDESK_SUBDOMAIN, FASTLY_LOCAL_ZENDESK_API_EMAIL, and FASTLY_LOCAL_ZENDESK_API_TOKEN',
    'before running npm run fastly:local if you want real Zendesk ticket creation.',
  ].join('\n'),
);
