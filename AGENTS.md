# Repository Guidelines

## AI Acknowledgment

Check for `.ai-ack` in the repository root (next to `.git`) before any other
work. If the file is missing, read `HUMAN_VS_MACHINE.md` and follow its
instructions before proceeding.

## Read First

- `CONTRIBUTING.md`: PR rules, testing expectations, scope discipline.
- `ARCHITECTURE.md`: project structure, naming conventions, module organization.
  When changing files referenced there, update it in the same commit.
- `HUMAN_VS_MACHINE.md`: human/machine collaboration protocol.
- `.agents/SKILLS.md`: on-demand skill modules for specific work areas.

## Quick Commands

- `npm run dev`: install deps, start Vite on `http://localhost:8080`.
- `npm run test`: type-check, lint (TS + HTML), run unit tests (Vitest/jsdom),
  build.
- `npm run build`: install deps, build, copy `index.html` to `404.html`.
- `vitest run`: execute tests in CI mode.
- `npx eslint src/`: lint TypeScript and HTML.
- Deploy: `npm run deploy` (nostr-deploy-cli), `npm run deploy:cloudflare`,
  `npm run deploy:preview`.

## Security

Do not commit secrets. Configure deploy targets via `wrangler.toml` and
environment variables. Verify `public/manifest.webmanifest` and required HTML
meta tags (enforced by HTML ESLint rules) before deploy.
