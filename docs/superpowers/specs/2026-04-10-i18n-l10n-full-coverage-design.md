# i18n/L10n Full Coverage Design

**Date:** 2026-04-10

## Goal

Expand the existing i18n kickoff implementation so every app-owned page, dialog, menu, helper message, and marketing page in Divine Web is available in all 15 supported languages, while leaving user-generated content untouched. `Terms` and `Privacy` remain English-only for now.

## Scope

This follow-up builds on PR 229 and the existing `feat/i18n-l10n-kickoff` branch instead of starting from a fresh branch. The i18n foundation already exists. This work completes translation coverage across the product.

Included in this phase:

- convert all route pages that still contain hard-coded app-owned copy
- convert dialogs, forms, toasts, menus, helper text, empty states, and error text that remain in English
- move long-form support, FAQ, safety, and marketing copy into translation catalogs
- keep translation coverage aligned across all 15 locales
- add regression tests that catch missing locale keys outside the kickoff scope

Explicitly out of scope:

- translating user-generated content such as comments, usernames, bios, captions, and note bodies
- translating `Terms` and `Privacy` beyond their current English presentation
- locale in URLs
- server-side locale rendering
- human translation review workflow

## Supported Languages

- English (`en`)
- Spanish (`es`)
- Turkish (`tr`)
- Japanese (`ja`)
- German (`de`)
- Portuguese (`pt`)
- French (`fr`)
- Indonesian (`id`)
- Dutch (`nl`)
- Swedish (`sv`)
- Romanian (`ro`)
- Italian (`it`)
- Polish (`pl`)
- Korean (`ko`)
- Arabic (`ar`)

## Architecture

Keep the existing `i18next` and `react-i18next` foundation. Expand catalog organization from the kickoff's shell-focused `common` coverage into a lightweight namespace model:

- `common` for shared UI, chrome, repeated actions, and cross-page states
- additional namespaces for large page domains where keeping everything in `common` would become brittle

The exact namespace boundaries should stay pragmatic. Large pages such as Safety, FAQ, About, and other support or marketing surfaces should move into dedicated page or domain namespaces instead of embedding long English blocks in JSX. `Terms` and `Privacy` can keep their current namespace scaffolding for consistency, but they should not be part of the translation completion target.

All locale resources must mirror English namespace and key structure exactly. English remains the source locale and fallback.

## Conversion Strategy

This should be executed as a broad but mechanical refactor:

1. audit routes and shared components for remaining hard-coded app-owned strings
2. add missing English keys in the appropriate namespace
3. generate matching machine-authored translations for the other 14 locales
4. replace inline strings with `t(...)` lookups
5. add or update focused tests for converted pages and shared components
6. run full repository verification before updating the PR

The priority is complete implementation coverage across the app, not linguistic perfection. Later human review can improve copy without changing the architecture.

## Behavior Requirements

- language switching must immediately affect all app-owned UI within the agreed scope
- Arabic must continue to switch the document direction to RTL
- missing keys must fall back to English rather than breaking rendering
- locale coverage tests must fail if English adds keys that other locales do not implement

## Testing Strategy

Add regression coverage in three layers:

- locale parity tests for every namespace in every supported locale
- targeted component or page tests proving translated copy renders for representative non-English locales
- full `npm test` verification before claiming the branch is ready

The result should make “full app-owned translation coverage” true for PR 229 rather than only “kickoff infrastructure plus partial shell coverage.”
