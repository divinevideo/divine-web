# Top-Countries Localization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Vietnamese (vi), Urdu (ur), Simplified Chinese (zh), and Malay (ms) locales so visitors from our top-10 countries get Divine in their language automatically.

**Architecture:** Existing `react-i18next` setup with eager Vite glob loading (`src/lib/i18n/`). Detection already works via `navigator.languages` → base-language normalization → English fallback; manual override via `LanguageMenu`. This plan registers 4 new locales in config, adds Urdu RTL support, and drops in 44 translated JSON files produced from brand-voice style briefs. Design doc: `docs/plans/2026-07-30-top-countries-localization-design.md`.

**Tech Stack:** i18next 26, react-i18next 17, Vitest, TypeScript.

**Branch:** `feat/top-countries-locales` (already created, design doc committed).

---

### Task 1: Failing tests for new locale mappings and Urdu RTL

**Files:**
- Modify: `src/lib/i18n/config.test.ts`

**Step 1: Update two existing tests that intentionally change behavior**

Once `zh` is supported, `zh-CN` resolves to `zh` instead of falling through. Update the two tests that rely on `zh-CN` being unsupported (this is the intended feature, not a regression):

In the `matches regional browser locales` test, change:

```ts
expect(resolveInitialLocale(['zh-CN', 'de-DE'])).toBe('de');
```

to:

```ts
expect(resolveInitialLocale(['th-TH', 'de-DE'])).toBe('de');
```

In the `falls back to english when no locale matches` test, change:

```ts
expect(resolveInitialLocale(['zh-CN', 'th-TH'])).toBe(DEFAULT_LOCALE);
```

to:

```ts
expect(resolveInitialLocale(['th-TH', 'uk-UA'])).toBe(DEFAULT_LOCALE);
```

**Step 2: Add the new failing tests**

Append inside `describe('i18n config')`:

```ts
  it('resolves top-country locales (vi, ur, zh, ms) from regional variants', () => {
    expect(resolveInitialLocale(['vi-VN'])).toBe('vi');
    expect(resolveInitialLocale(['ur-PK'])).toBe('ur');
    expect(resolveInitialLocale(['zh-SG'])).toBe('zh');
    expect(resolveInitialLocale(['zh-CN'])).toBe('zh');
    expect(resolveInitialLocale(['ms-MY'])).toBe('ms');
    expect(resolveInitialLocale(['ms-SG'])).toBe('ms');
  });

  it('uses rtl direction for arabic and urdu', () => {
    expect(getLocaleDirection('ar')).toBe('rtl');
    expect(getLocaleDirection('ur')).toBe('rtl');
    expect(getLocaleDirection('en')).toBe('ltr');
    expect(getLocaleDirection('zh')).toBe('ltr');
  });
```

Also rename the existing `uses rtl direction for arabic only` test to `uses rtl direction for arabic` and drop its now-redundant assertions (the new test above covers direction comprehensively). Net result: one direction test replaced by the broader one.

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/i18n/config.test.ts`
Expected: FAIL — `resolveInitialLocale(['vi-VN'])` returns `en`, `getLocaleDirection('ur')` returns `ltr`.

**Step 4: Commit**

```bash
git add src/lib/i18n/config.test.ts
git commit -m "test: add failing expectations for vi/ur/zh/ms locale resolution"
```

---

### Task 2: Wire the four locales into config

**Files:**
- Modify: `src/lib/i18n/config.ts:1-49,144-146`

**Step 1: Make the minimal config changes**

In `SUPPORTED_LOCALES`, append (keep the existing entries' order, add new ones at the end):

```ts
  'fil',
  'vi',
  'ur',
  'zh',
  'ms',
] as const;
```

In `LOCALE_OPTIONS`, append:

```ts
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
];
```

In `getLocaleDirection`, change:

```ts
return locale === 'ar' ? 'rtl' : 'ltr';
```

to:

```ts
return locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/lib/i18n/config.test.ts`
Expected: PASS (all tests).

**Step 3: Commit**

```bash
git add src/lib/i18n/config.ts
git commit -m "feat(i18n): register vi, ur, zh, ms locales with Urdu RTL"
```

---

### Task 3: Placeholder-parity guard for all locales

**Files:**
- Modify: `src/lib/i18n/locales.test.ts`

**Step 1: Add the parity test**

Append a helper and test. Interpolation placeholders like `{{count}}` must survive translation verbatim, per key, in every locale:

```ts
function extractPlaceholders(value: unknown): string[] {
  if (typeof value === 'string') {
    return [...value.matchAll(/\{\{[^}]+\}\}/g)].map((match) => match[0]).sort();
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).flatMap(extractPlaceholders);
  }
  return [];
}

// Inside the existing describe block:
  it('preserves interpolation placeholders across every locale', () => {
    for (const [namespace, englishCatalog] of Object.entries(resources.en)) {
      const englishKeys = flattenKeys(englishCatalog).sort();

      for (const key of englishKeys) {
        const englishValue = key.split('.').reduce<unknown>(
          (node, segment) => (node as Record<string, unknown>)?.[segment],
          englishCatalog,
        );
        const expected = extractPlaceholders(englishValue);
        if (expected.length === 0) continue;

        for (const [locale, namespaces] of Object.entries(resources)) {
          const localeCatalog = namespaces[namespace as keyof typeof namespaces];
          const localeValue = key.split('.').reduce<unknown>(
            (node, segment) => (node as Record<string, unknown>)?.[segment],
            localeCatalog,
          );
          expect(
            extractPlaceholders(localeValue),
            `${locale}.${namespace}:${key} must keep placeholders ${expected.join(' ')}`,
          ).toEqual(expected);
        }
      }
    }
  });
```

**Step 2: Run against the existing 16 locales**

Run: `npx vitest run src/lib/i18n/locales.test.ts`
Expected: PASS. If it fails on pre-existing locales, do NOT fix old locales in this branch — report the drift to Rabble and continue (scope discipline; the new locales must pass).

**Step 3: Commit**

```bash
git add src/lib/i18n/locales.test.ts
git commit -m "test: guard interpolation placeholder parity across locales"
```

---

### Tasks 4–7: Translate the four locales

One task per locale, executed by a fresh translation subagent each time. Each locale task is identical in mechanics; only the style brief differs.

**Files (per locale `XX` ∈ {vi, ur, zh, ms}):**
- Create: `src/lib/i18n/locales/XX/about.json`
- Create: `src/lib/i18n/locales/XX/authenticity.json`
- Create: `src/lib/i18n/locales/XX/common.json`
- Create: `src/lib/i18n/locales/XX/dmca.json`
- Create: `src/lib/i18n/locales/XX/faq.json`
- Create: `src/lib/i18n/locales/XX/humanCreated.json`
- Create: `src/lib/i18n/locales/XX/openSource.json`
- Create: `src/lib/i18n/locales/XX/privacy.json`
- Create: `src/lib/i18n/locales/XX/proofmode.json`
- Create: `src/lib/i18n/locales/XX/safety.json`
- Create: `src/lib/i18n/locales/XX/terms.json`
- Source: `src/lib/i18n/locales/en/*.json` (read every file fully)

**Shared translation rules (include verbatim in every subagent prompt):**

1. Translate VALUES only. Never translate, rename, add, drop, or reorder JSON keys. Keep key order identical to English.
2. Preserve every `{{placeholder}}` verbatim (e.g. `{{count}}`, `{{date}}`). Never translate placeholder names.
3. Plural suffixes: keys ending `_one` / `_other` are i18next plural forms. vi, zh, ms have no grammatical plural — translate both forms identically (natural phrasing without number inflection). ur inflects singular vs plural properly.
4. Protected vocabulary — never translate: Divine, Vine, Nostr, ProofMode, Blossom, keycast, npub, nsec, WebSocket, RSS, HLS.
5. "loop/loops" (the 6-second video unit) uses exactly one fixed term per locale (see briefs). Do not improvise alternates.
6. Tone per `docs/brand/TONE_OF_VOICE.md`: casual-direct, playful microcopy, zero corporate speak. Re-create punch lines idiomatically; do not produce flat calques. Examples of the English energy to match: "Nothing here yet. Go find your people." / "Your loop is live. Let's go." / "Nada. Try something different?"
7. Namespace tone dial: `common.json` = high playful; error messages = medium playful; `safety`, `terms`, `privacy`, `dmca` labels = neutral and factual.
8. Strings like "Last Updated: March 30, 2026" are fully localized including the date (precedent: Turkish `Son Güncelleme: 30 Mart 2026`).
9. Output valid JSON, UTF-8, 2-space indent, no trailing commas, no comments.
10. Do not modify any file outside `src/lib/i18n/locales/XX/`.

**Per-locale style briefs:**

- **Task 4 — vi (Vietnamese):** Address the user as *bạn*. Short, punchy sentences. "loop" = *vòng lặp* (in product context prefer just *vòng* where natural, but pick one primary form and stay consistent). Anchor strings (must match exactly): `common.nav.home` = `Trang chủ`, `common.nav.search` = `Tìm kiếm`, `common.nav.profile` = `Hồ sơ`.
- **Task 5 — ur (Urdu):** Address the user as *آپ* (never *تم* — reads rude from a product). Playful phrasing inside the polite *آپ* frame. "loop" = *لوپ* (loanword, standard in Pakistani tech slang). RTL-aware: no leading emoji or Latin punctuation that breaks bidi; keep `{{placeholders}}` LTR-safe (i18next handles embedding). Anchor strings: `common.nav.home` = `ہوم`, `common.nav.search` = `تلاش`, `common.nav.profile` = `پروفائل`.
- **Task 6 — zh (Simplified Chinese):** 你, never 您. Singapore/Mainland internet-casual register, no textbook stiffness. "loop" = *循环* (product noun, e.g. 6 秒循环). Anchor strings: `common.nav.home` = `首页`, `common.nav.search` = `搜索`, `common.nav.profile` = `个人资料`.
- **Task 7 — ms (Malay):** *anda* (standard UI register; *kamu* too intimate at scale). "loop" = *gelung*. Anchor strings: `common.nav.home` = `Utama`, `common.nav.search` = `Cari`, `common.nav.profile` = `Profil`.

**Steps per locale task (repeat for each of vi, ur, zh, ms):**

**Step 1:** Dispatch a subagent with: the shared rules, the locale style brief, and instructions to read every `src/lib/i18n/locales/en/*.json` file fully and write the translated counterparts to `src/lib/i18n/locales/XX/`.

**Step 2: Verify alignment + placeholders + validity**

Run: `npx vitest run src/lib/i18n/locales.test.ts`
Expected: PASS — no missing keys for `XX`, placeholder parity holds. If it fails, fix the reported keys (iterate with the subagent or directly) until green.

**Step 3: JSON parse sanity**

Run: `for f in src/lib/i18n/locales/XX/*.json; do python3 -m json.tool "$f" > /dev/null || echo "INVALID: $f"; done; echo OK`
Expected: `OK` with no INVALID lines.

**Step 4: Commit**

```bash
git add src/lib/i18n/locales/XX/
git commit -m "feat(i18n): add <Language> (XX) locale"
```

Commit messages per task: `add Vietnamese (vi) locale`, `add Urdu (ur) locale`, `add Simplified Chinese (zh) locale`, `add Malay (ms) locale`.

---

### Task 8: End-to-end initialization tests for the new locales

**Files:**
- Modify: `src/lib/i18n/index.test.ts`

**Step 1: Add the failing-then-passing integration tests**

Append inside `describe('i18n bootstrap')`:

```ts
  it('initializes in vietnamese from a regional browser locale', async () => {
    const i18n = await createI18nInstance({ languages: ['vi-VN'] });

    expect(i18n.language).toBe('vi');
    expect(i18n.t('nav.home')).toBe('Trang chủ');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('initializes in urdu with rtl direction', async () => {
    const i18n = await createI18nInstance({ languages: ['ur-PK'] });

    expect(i18n.language).toBe('ur');
    expect(i18n.t('nav.search')).toBe('تلاش');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('initializes in simplified chinese from singapore', async () => {
    const i18n = await createI18nInstance({ languages: ['zh-SG'] });

    expect(i18n.language).toBe('zh');
    expect(i18n.t('nav.home')).toBe('首页');
  });

  it('initializes in malay', async () => {
    const i18n = await createI18nInstance({ languages: ['ms-MY'] });

    expect(i18n.language).toBe('ms');
    expect(i18n.t('nav.home')).toBe('Utama');
  });
```

`defaultNS` is `common`, so `i18n.t('nav.home')` resolves `common:nav.home`. The asserted values are the anchor strings pinned in the Tasks 4–7 briefs; if native review later changes them, update these assertions in the same commit.

**Step 2: Run**

Run: `npx vitest run src/lib/i18n/index.test.ts`
Expected: PASS (these pass immediately after Tasks 2–7 land; write them now and keep green).

**Step 3: Commit**

```bash
git add src/lib/i18n/index.test.ts
git commit -m "test: cover end-to-end bootstrap for vi, ur, zh, ms"
```

---

### Task 9: Doc count update + full verification

**Files:**
- Modify: `ARCHITECTURE.md:100-101`

**Step 1: Update the locale count**

Change "internationalization across 16 locales" to "internationalization across 20 locales".

**Step 2: Full suite**

Run: `npm test`
Expected: tsc clean, eslint clean, all vitest suites pass, build succeeds.

**Step 3: Manual smoke (dev server)**

Run: `npm run dev`, then in browser: switch each new locale in `LanguageMenu` (sidebar/header), confirm nav strings render per the anchor strings, confirm Urdu flips layout to RTL, confirm a reload preserves the selection (localStorage), confirm fresh-visitor auto-detect via DevTools `navigator.languages` spoofing or system language.

**Step 4: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: note 20 locales in architecture overview"
```

---

## Execution Notes

- Task order matters: 1 → 2 → 3 → 4–7 (any order among them, parallel subagents OK) → 8 → 9.
- Do not bundle lockfile changes, formatting churn, or unrelated fixes into any commit (PR conventions).
- If the placeholder-parity test (Task 3) exposes drift in the 16 pre-existing locales, report it; do not fix in this branch.
