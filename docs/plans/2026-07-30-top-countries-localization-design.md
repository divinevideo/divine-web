# Top-Countries Localization — Design

Date: 2026-07-30
Status: Approved (brainstorming session with Rabble)

## Goal

Analytics show our top 10 countries are: Singapore, United States, Vietnam,
Brazil, Canada, United Kingdom, Pakistan, Türkiye, France, Argentina. Every
visitor from those countries should see Divine in their language,
automatically, on first load.

## Current State

- i18n infrastructure already exists: `react-i18next` + eager Vite glob
  loading (`src/lib/i18n/`).
- Automatic detection already works: `resolveInitialLocale` → stored
  `localStorage` override → `navigator.languages` → English fallback.
  `LanguageMenu` provides manual switching.
- 16 locales are fully translated (1,238 keys each across 11 namespaces):
  ar, de, en, es, fil, fr, id, it, ja, ko, nl, pl, pt, ro, sv, tr.
- `locales.test.ts` enforces key alignment with English for every locale.

## Gap Analysis

| Country | Language | Status |
|---|---|---|
| Singapore | English (lingua franca), Mandarin, Malay | en covered; zh/ms missing |
| United States | English | covered |
| Vietnam | Vietnamese | **missing (vi)** |
| Brazil | Portuguese | covered (pt) |
| Canada | English / French | covered |
| United Kingdom | English | covered |
| Pakistan | Urdu | **missing (ur)** |
| Türkiye | Turkish | covered |
| France | French | covered |
| Argentina | Spanish | covered |

## Scope

Add four locales: **vi** (Vietnamese), **ur** (Urdu), **zh** (Simplified
Chinese, Singapore standard), **ms** (Malay).

## Design

### 1. Locale wiring (`src/lib/i18n/config.ts`)

- `SUPPORTED_LOCALES` += `'vi'`, `'ur'`, `'zh'`, `'ms'`.
- `LOCALE_OPTIONS` += native-name entries: Vietnamese / Tiếng Việt; Urdu /
  اردو; Chinese (Simplified) / 简体中文; Malay / Bahasa Melayu.
- `getLocaleDirection`: `'ur'` joins `'ar'` as RTL. `applyDocumentLocale`
  sets `<html dir="rtl">` automatically (same plumbing Arabic uses).
- No detection changes: `normalizeLocale`'s base-language split already maps
  `vi-VN→vi`, `ur-PK→ur`, `zh-SG/zh-CN→zh`, `ms-MY/ms-SG→ms`.
- Accepted edge: `zh-TW`/`zh-HK` (Traditional) fall through to Simplified.
  Not our top-10 audience; fix later via `LOCALE_ALIASES` if `zh-Hant` is
  ever added.
- New resource dirs `src/lib/i18n/locales/{vi,ur,zh,ms}/` with all 11
  namespaces (about, authenticity, common, dmca, faq, humanCreated,
  openSource, privacy, proofmode, safety, terms). Vite glob auto-loads them;
  `LanguageMenu` picks up new options automatically.
- Legal bodies stay hardcoded English per the existing rollout decision;
  prerender stays English-only; no new dependencies.

### 2. Translation production (brand voice)

Translations are LLM-generated in-session (matches how the existing 16
locales were produced), following `docs/brand/TONE_OF_VOICE.md`. Intent is
translated, not words.

Per-language style briefs:

- **Protected vocabulary (never translated):** Divine, Vine, Nostr,
  ProofMode, Blossom, keycast, npub/nsec.
- **"Loop"** gets one fixed equivalent per language, reused everywhere:
  vi: *vòng lặp*; zh: *循环*; ms: *gelung*; ur: *لوپ* (loanword, standard in
  Urdu tech slang).
- **Register:**
  - vi: *bạn*, short punchy sentences.
  - zh: 你 (not 您), Singapore/Mainland internet-casual.
  - ms: *anda* (standard UI register; *kamu* too intimate at scale).
  - ur: *آپ* (respectful default; *تم* would read rude from a product),
    playful within that politeness frame; RTL/bidi-aware punctuation.
- **Tone dial (per TONE_OF_VOICE.md):** UI chrome (common.json) = high
  playful, idiomatic adaptation rather than calque; error messages = medium;
  safety/terms/privacy/dmca labels = neutral.
- **Microcopy is re-created, not translated:** "Nothing here yet. Go find
  your people." gets an equivalent local punch line with the same energy.
- Plural forms: catalog uses i18next `_one`/`_other` suffixes. vi/zh/ms have
  no grammatical plural — both keys present and identical; ur inflects both.

Mechanics: one subagent per locale, given the style brief + English source,
producing all 11 JSON files. Hard gates afterward (see below).

### 3. Testing & verification (TDD)

RED first:

1. `config.test.ts`: `normalizeLocale('vi-VN')→'vi'`, `('ur-PK')→'ur'`,
   `('zh-SG')→'zh'`, `('ms-MY')→'ms'`; `getLocaleDirection('ur')→'rtl'`.
2. Placeholder-parity test in `locales.test.ts`: every `{{var}}` in each
   English value must appear in the translated value, for all locales.
   (Applied to all locales; if it surfaces pre-existing drift in old
   locales, that drift is reported, not silently fixed — scope discipline.)

GREEN: config wiring + 44 JSON files.

Existing gates that auto-apply: `locales.test.ts` key alignment;
`index.test.ts` initialization.

Integration: a vitest that calls `initializeI18n({ force: true, languages:
[...] })` per new locale and asserts known UI strings render in the target
language (not English fallback).

Human verification: `npm run dev`, switch each locale in `LanguageMenu`,
eyeball Urdu RTL layout; then full `npm test`.

## Non-goals

- Traditional Chinese, Hindi, or other speculative locales.
- Translating legal document bodies.
- Professional/native review (can land as follow-up PRs against these LLM
  drafts).
- Date-fns locale wiring (dates remain English-formatted; separate concern).
