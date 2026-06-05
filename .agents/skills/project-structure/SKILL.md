---
name: project-structure
description: |
  Project structure and file organization for divine-web. Load when creating
  new files, moving code, or navigating the codebase.
---

# Project Structure

## Source Layout

`src/` is the application root.

- `src/components/`: reusable UI components. PascalCase filenames matching the
  component name (e.g. `VideoCard.tsx`).
- `src/pages/`: route-level page components. `*Page.tsx` naming (e.g.
  `HomePage.tsx`, `ProfilePage.tsx`).
- `src/hooks/`: custom React hooks. `useX` naming in `.ts` files (e.g.
  `useNostr.ts`).
- `src/lib/`: utilities, helpers, non-React logic.
- `src/contexts/`: React context providers and their associated hooks.
- `src/types/`: shared TypeScript type definitions and interfaces.
- `src/test/`: test setup (`setup.ts`) and shared test utilities.
- `src/config/`: runtime configuration and constants.
- `src/data/`: static data files and fixtures.
- `src/styles/`: global CSS and style definitions beyond Tailwind utilities.

## Entry Point Flow

```
index.html → src/main.tsx → src/App.tsx → src/AppRouter.tsx
```

## Import Alias

`@/` maps to `src/`. Configured in `tsconfig.json` paths and `vite.config.ts`
resolve.alias. Use `@/` for all app imports.

## Public Assets

`public/` holds static assets served as-is: `manifest.webmanifest`,
`_redirects`, and other files that don't need processing.

## Build Output

`dist/` receives the production build. During build, `index.html` is copied to
`404.html` to support SPA routing on static hosts.

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build configuration |
| `tailwind.config.ts` | TailwindCSS configuration |
| `eslint.config.js` | ESLint configuration |
| `tsconfig.json` | Root TypeScript config |
| `tsconfig.app.json` | App source TypeScript config |
| `tsconfig.node.json` | Node/tooling TypeScript config |

## Custom ESLint Rules

`eslint-rules/` contains project-specific rules: `no-inline-script`,
`no-placeholder-comments`, `require-webmanifest`. No inline `eslint-disable`
comments.

## Build Scripts

`scripts/` holds build and utility scripts:

- `copy-well-known.mjs` / `verify-well-known.mjs`: handle `.well-known` files
- `prerender-legal.mjs`: prerender legal pages
- `generate-icons.js`: generate app icons
- `precalculate-hashtag-thumbnails.ts`: precompute thumbnail data
- `verify-relay-config.ts`: validate relay configuration
- `audit-microcopy.mjs` / `a11y-audit.mjs`: content and accessibility audits

## Documentation

`docs/` contains project documentation:

- `docs/brand/`: brand guidelines and assets
- `docs/superpowers/plans/`: implementation plans
- `docs/superpowers/specs/`: feature specifications
- `docs/` root: architecture docs, relay docs, migration guides

## File Placement Quick Reference

| Adding a... | Put it in... | Named... |
|------------|-------------|----------|
| New page | `src/pages/` | `FooPage.tsx` |
| New component | `src/components/` | `Foo.tsx` |
| New hook | `src/hooks/` | `useFoo.ts` |
| New utility | `src/lib/` | `foo.ts` |
| New context | `src/contexts/` | `FooContext.tsx` |
| New type | `src/types/` | `foo.ts` |
| New test | Next to source | `foo.test.ts` or `foo.test.tsx` |
