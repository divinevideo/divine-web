---
name: coding-conventions
description: |
  Coding style and naming conventions for divine-web. Load when writing or
  editing TypeScript, React components, hooks, or styles.
---

# Coding Conventions

## Language and File Types

- TypeScript + React 18.
- Components: `.tsx`. Utilities and non-component code: `.ts`.
- One component per file. One hook per file.

## Naming

- Components: `PascalCase` named exports. Default exports only for page
  components when router lazy loading requires it.
- Hooks: `useX` prefix. Custom hooks live in `src/hooks/`.
- Pages: `*Page.tsx` suffix in `src/pages/`.
- Test files: `*.test.ts(x)`, colocated with the source file.

## Imports

- Use `@/` alias for anything under `src/`.
- Group imports: external packages first, blank line, then `@/` internal
  imports.

## Styling

- TailwindCSS utility classes only.
- Use `tailwind-merge` (`twMerge`) to resolve conflicting classes in composed
  components.
- No CSS modules. No styled-components. No inline styles unless the value is
  dynamic (e.g., computed at runtime).

## File Organization

| Path | Contents |
|---|---|
| `src/components/` | Reusable UI components |
| `src/pages/` | Route-level page components |
| `src/hooks/` | Custom React hooks |
| `src/lib/` | Utility functions and shared logic |
| `src/contexts/` | React context providers |
| `src/types/` | Shared TypeScript type definitions |
| `src/test/` | Test setup and utilities |

## Comments and TODOs

- Do not write comments unless explicitly asked.
- No placeholder comments (e.g., `// add logic here`).
- TODOs must reference an issue: `TODO(#123): description`. Bare `TODO`,
  `FIXME`, or `HACK` without an issue reference will fail lint.

## Linting

- ESLint with TypeScript, React Hooks, and HTML plugins.
- Custom rules in `eslint-rules/`:
  - `no-inline-script`: forbids inline `<script>` tags in HTML.
  - `no-placeholder-comments`: forbids TODO/FIXME without issue reference.
  - `require-webmanifest`: ensures `public/manifest.webmanifest` exists.
- No inline `eslint-disable` comments. Fix the lint issue instead.

## Exports

- Prefer named exports everywhere.
- Default exports are acceptable for page components when the router uses
  `React.lazy()` to load them.
