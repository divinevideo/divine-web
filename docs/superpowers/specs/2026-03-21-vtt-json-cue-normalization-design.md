# VTT JSON Cue Normalization Design

**Date:** 2026-03-21
**Branch:** `codex/vtt-json-empty-text`

## Problem

Some subtitle tracks are delivered as valid `WEBVTT` files whose cue body is a JSON object rather than plain subtitle text, for example:

```text
WEBVTT

1
00:00:00.000 --> 99:59:59.000
{"text":"","usage":{"type":"tokens","total_tokens":65}}
```

The current parser treats any non-empty cue body as displayable text, so this JSON blob is rendered on screen for the full cue duration.

## Goal

Normalize structured JSON cue bodies at the parser boundary so subtitle rendering only receives displayable text.

## Decision

Update `parseVtt` in `src/lib/vttParser.ts` to recognize cue bodies that are JSON objects and apply these rules:

1. If the parsed object has a `text` property with a non-empty string value, use that string as the cue text.
2. If the `text` property is an empty string or only whitespace, drop the cue.
3. If the parsed object does not have a string `text` property, drop the cue.
4. If the cue body is not valid JSON, keep the existing plain-text parsing behavior.

## Scope

In scope:
- Parser normalization in `src/lib/vttParser.ts`
- Regression tests in `src/lib/vttParser.test.ts`

Out of scope:
- UI or overlay changes
- Fetch-path changes in `src/hooks/useSubtitles.ts`
- Broader subtitle-format support beyond JSON cue bodies with a `text` field

## Testing

Add parser tests for:

- JSON cue body with `{"text":"","usage":...}` returning no cues
- JSON cue body with `{"text":"Hello","usage":...}` returning a normal cue with `text === "Hello"`

Run the focused parser tests first, then the full `npm run test` suite.
