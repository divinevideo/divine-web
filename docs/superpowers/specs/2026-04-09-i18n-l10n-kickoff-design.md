# i18n/L10n Kickoff Design

**Date:** 2026-04-09

## Goal

Kick off client-side internationalization and localization for Divine Web so the app can auto-detect a supported browser language, let users choose a different language manually, persist that override, and render shared shell and core status UI in the first supported set of 15 languages.

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

## Scope

This kickoff is infrastructure-first. It should deliver the locale plumbing, language catalogs, detection and persistence behavior, language switching UI, and an initial conversion pass over the shared app shell and repeated high-traffic status copy.

Included in this phase:

- initialize `i18next` and `react-i18next` in the client app
- detect locale from `navigator.languages` on first visit
- persist manual language overrides in local storage
- update the document `lang` and `dir` attributes when locale changes
- provide translation catalogs for all supported languages
- convert shared shell UI such as header, sidebar, bottom navigation, and common actions/status labels
- convert common loading, empty, and error states that appear frequently in core app flows

Explicitly out of scope for this kickoff:

- locale in URLs or route structure
- server-side locale rendering
- backend translation delivery
- machine-translating long-form legal, support, or editorial pages
- translating every page in the product in one pass

## User-Facing Behavior

### Locale Selection

On first visit, the app should inspect `navigator.languages` and choose the best supported locale match. Matching should prefer the base language when the browser reports a regional variant such as `es-MX` or `pt-BR`.

If no supported locale matches, the app should fall back to English.

Once a user explicitly changes their language in the UI, that manual override should be stored locally and should take precedence on future visits until the user changes it again.

### URL Behavior

Locale must not appear in the URL. Existing routes remain unchanged, and route resolution must not depend on language.

### Accessibility and Directionality

The app must update `document.documentElement.lang` to the active locale code. It must set `dir="rtl"` for Arabic and `dir="ltr"` for all other supported locales so layout and screen-reader behavior follow the chosen language.

## Architecture

### Library Choice

Use `i18next` with `react-i18next` as the translation engine. This gives the project a standard client-side localization stack with interpolation, pluralization, fallback handling, and incremental component adoption without inventing a custom system.

### App Integration

Add a small i18n layer under `src/lib/i18n/` to centralize:

- supported locale metadata
- browser-locale matching
- persistence helpers
- i18next initialization
- utility helpers for language display names and document direction

Initialize that layer before the React tree renders, then provide it at the top of the app so components can opt in through `useTranslation`.

### Catalog Structure

Use semantic translation keys rather than English sentence keys. Start with a `common` namespace for the kickoff so shared shell and repeated states can move quickly. The file layout should support later expansion into additional namespaces without restructuring the core setup.

Recommended layout:

- `src/lib/i18n/config.ts`
- `src/lib/i18n/locales/<locale>/common.json`
- optional locale helper types/utilities alongside config

### Language Switcher

Place the language switcher in the existing app shell rather than adding new navigation. The current overflow menu in the header is the best initial home because it already contains other global preferences and informational actions.

The switcher should list the supported languages with human-readable names and update the locale immediately when selected.

## Incremental Conversion Strategy

The first implementation pass should focus on the shared shell and repeated UI copy rather than dense long-form pages.

Priority targets:

- header, sidebar, and bottom navigation labels
- overflow menu labels
- repeated login/auth prompts
- common loading and empty states
- repeated toast titles or generic action labels where practical
- a small set of core page-level labels needed to prove end-to-end wiring

Deferred targets:

- Terms
- Privacy
- Safety
- Support
- FAQ
- dense mission/marketing/editorial pages

## Failure Behavior

- Missing translation key: fall back to English
- Unsupported browser locale: fall back to English
- Corrupt persisted locale: ignore it and re-run locale selection from supported locales
- Missing catalog entry in a non-English locale: show the English fallback rather than breaking rendering

## Testing Strategy

### Unit Tests

Add tests for:

- supported locale matching from regional browser inputs
- fallback to English when no locale matches
- persistence helpers
- right-to-left detection for Arabic

### App and Component Tests

Add tests proving:

- auto-detection is applied on first load
- a persisted manual override wins over browser preferences
- the language switcher updates locale state
- document `lang` and `dir` are updated correctly
- at least a few shared shell labels render translated output for a non-English locale

### Regression Goals

The result should make later i18n work mostly a matter of moving strings into catalogs and adding tests, without revisiting app-wide locale architecture.

## Rationale

This approach keeps the kickoff focused:

- it provides real multi-language support immediately
- it avoids route churn and SEO complexity from URL-locales
- it keeps the first pass on shared UI where coverage is broad and valuable
- it avoids shipping low-confidence translated legal/editorial content as part of the initial infrastructure rollout
