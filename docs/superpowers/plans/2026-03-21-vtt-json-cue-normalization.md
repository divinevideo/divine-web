# VTT JSON Cue Normalization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent structured JSON subtitle cue payloads with empty `text` values from rendering on screen while still supporting JSON cue payloads with displayable text.

**Architecture:** Keep the change inside the VTT parser so downstream subtitle fetching and rendering continue to consume normal `VttCue[]` values. Extend parser tests first, then implement the smallest parser helper needed to normalize JSON cue bodies before cues are emitted.

**Tech Stack:** TypeScript, Vitest, Vite

---

## Chunk 1: Parser Regression Coverage

### Task 1: Add failing tests for JSON cue bodies

**Files:**
- Modify: `src/lib/vttParser.test.ts`
- Test: `src/lib/vttParser.test.ts`

- [ ] **Step 1: Write the failing tests**

Add two tests in `src/lib/vttParser.test.ts`:

```ts
it('drops JSON cues with an empty text field', () => {
  const vtt = `WEBVTT

1
00:00:00.000 --> 99:59:59.000
{"text":"","usage":{"type":"tokens","total_tokens":65}}`;

  expect(parseVtt(vtt)).toEqual([]);
});

it('uses the text field from JSON cues when present', () => {
  const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:03.000
{"text":"Hello","usage":{"type":"tokens","total_tokens":65}}`;

  expect(parseVtt(vtt)).toEqual([
    { startTime: 0, endTime: 3, text: 'Hello' },
  ]);
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run src/lib/vttParser.test.ts`
Expected: FAIL because `parseVtt` currently returns the raw JSON body as cue text.

## Chunk 2: Minimal Parser Change

### Task 2: Normalize structured cue bodies in the parser

**Files:**
- Modify: `src/lib/vttParser.ts`
- Test: `src/lib/vttParser.test.ts`

- [ ] **Step 3: Write the minimal implementation**

Add a small helper in `src/lib/vttParser.ts` that:

```ts
function normalizeCueText(rawText: string): string | null {
  const stripped = stripTags(rawText).trim();
  if (!stripped) return null;

  try {
    const parsed = JSON.parse(stripped) as { text?: unknown };
    if (typeof parsed.text !== 'string') return null;
    const normalized = parsed.text.trim();
    return normalized ? normalized : null;
  } catch {
    return stripped;
  }
}
```

Use that helper when building cues so only normalized non-empty text becomes a `VttCue`.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/lib/vttParser.test.ts`
Expected: PASS

## Chunk 3: Full Verification and Commit

### Task 3: Verify the full suite and save the change

**Files:**
- Modify: `docs/superpowers/specs/2026-03-21-vtt-json-cue-normalization-design.md`
- Modify: `docs/superpowers/plans/2026-03-21-vtt-json-cue-normalization.md`
- Modify: `src/lib/vttParser.ts`
- Modify: `src/lib/vttParser.test.ts`

- [ ] **Step 5: Run the repository verification suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit the work**

```bash
git add docs/superpowers/specs/2026-03-21-vtt-json-cue-normalization-design.md \
  docs/superpowers/plans/2026-03-21-vtt-json-cue-normalization.md \
  src/lib/vttParser.ts \
  src/lib/vttParser.test.ts
git commit -m "Fix structured VTT cue parsing"
```
