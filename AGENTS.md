# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` with `components/`, `pages/` (e.g., `HomePage.tsx`), `hooks/`, `lib/`, `contexts/`, `types/`, and test utilities under `src/test/`.
- Entry points: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/AppRouter.tsx`.
- Assets: `public/` (e.g., `manifest.webmanifest`, redirects). Build output: `dist/`.
- Config: `vite.config.ts`, `tailwind.config.ts`, `eslint.config.js`, `tsconfig*.json`, custom rules in `eslint-rules/`.
- Aliases: import app code via `@/…` (configured in `tsconfig` and Vite).

## Build, Test, and Development Commands
- `npm run dev`: Install deps and start Vite on `http://localhost:8080`.
- `npm run build`: Install deps, build, and copy `index.html` to `404.html`.
- `npm run test`: Type-check, lint (TS + HTML), run unit tests (Vitest/jsdom), then build.
- Deploy: `npm run deploy` (nostr-deploy-cli), `npm run deploy:cloudflare`, `npm run deploy:preview`.
- Example: `vitest run` executes tests in CI mode.

## Coding Style & Naming Conventions
- Language: TypeScript + React 18. Components in `.tsx`; utilities in `.ts`.
- Naming: Components `PascalCase`, hooks `useX`, pages `*Page.tsx`, tests `*.test.ts(x)` colocated with code.
- Styling: TailwindCSS; prefer utility classes and `tailwind-merge` to resolve conflicts.
- Linting: ESLint (TypeScript, React Hooks, HTML) + custom rules in `eslint-rules/`.
  - No inline `eslint-disable`. Avoid placeholder comments and inline `<script>` in HTML.

## Testing Guidelines
- Frameworks: Vitest + `@testing-library/react` with `jsdom`.
- Global setup: `src/test/setup.ts`.
- Place tests next to code (`*.test.ts` / `*.test.tsx`). Favor user-facing assertions.
- Run: `npm run test` or `vitest run`. Keep tests deterministic; mock browser APIs as needed.

## Commit & Pull Request Guidelines
- Commits: imperative, present tense (e.g., "Add profile page"); keep focused; reference issue IDs when applicable.
- PRs: include summary, motivation, screenshots for UI changes, and tests for new logic.
- CI hygiene: ensure `npm run test` passes locally before opening/merging PRs.

## Security & Deployment Notes
- Do not commit secrets. Configure deploy targets via `wrangler.toml` and environment variables.
- Verify `public/manifest.webmanifest` and required HTML meta (HTML ESLint rules) before deploy.
