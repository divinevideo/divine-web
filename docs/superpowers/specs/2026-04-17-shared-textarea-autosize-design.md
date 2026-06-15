# Shared Textarea Autosize Design

**Date:** 2026-04-17
**Branch:** `fix/dm-composer-autosize`

## Problem

The current DM composer in [src/pages/ConversationPage.tsx](/Users/rabble/code/divine/divine-web/.worktrees/fix-dm-composer-autosize/src/pages/ConversationPage.tsx:302) uses the shared [src/components/ui/textarea.tsx](/Users/rabble/code/divine/divine-web/.worktrees/fix-dm-composer-autosize/src/components/ui/textarea.tsx:7) with a fixed-feeling single-line layout. On desktop it looks cramped inside the thread card, and on small screens it does not scale naturally as longer messages wrap.

The shared textarea also does not autosize anywhere in the app. Forms such as profile editing, comments, wallet setup, and video metadata rely on `rows` or `min-h-*` classes for their starting size, then stay fixed even as content grows.

The current DM send flow clears the draft only after a successful mutation resolves, but the composer layout does not reset in a way that visibly matches the cleared state.

## Goal

Improve message composition without introducing one-off DM-only behavior:

1. Make the shared textarea autosize as users type.
2. Preserve each existing form's starting height so current layouts do not unexpectedly shrink or expand on first render.
3. Make the DM composer start at a roomier two-line baseline on mobile and desktop.
4. Cap textarea growth and switch to internal scrolling once the cap is reached.
5. Clear the DM draft only after a successful send, and reset the composer height back to its baseline when that happens.
6. Preserve the current DM keyboard behavior: `Enter` sends and `Shift+Enter` inserts a newline.

## Decision

Implement autosizing in the shared `Textarea` component and make it the default behavior for existing consumers.

The DM composer will opt into a two-line baseline by setting its initial size through existing props and classes, while the shared autosize behavior handles growth and reset. Other forms will keep their current `rows` or `min-h-*` starting height and gain only the new growth behavior.

## User Experience

### Shared Textareas

For every screen that uses the shared textarea:

- The field renders at its current baseline height.
- As content grows, the field expands smoothly with it.
- Once the field reaches its height cap, the textarea stops growing and scrolls internally.
- Programmatic value changes such as form resets also trigger the same resize logic.

### DM Composer

For the thread composer specifically:

- The textarea starts at two visible lines.
- The send button stays anchored at the bottom-right as the composer grows.
- On successful send, the draft clears and the composer snaps back to its two-line baseline.
- On failed send, the draft stays intact so the user can retry or edit it.

## Architecture

### Shared Textarea Behavior

Update [src/components/ui/textarea.tsx](/Users/rabble/code/divine/divine-web/.worktrees/fix-dm-composer-autosize/src/components/ui/textarea.tsx:1) so the component:

1. Measures its rendered baseline height after `rows`, default classes, and caller-provided classes have applied.
2. Resets its inline height to that baseline before measuring `scrollHeight`.
3. Sets its height to the smaller of content height and a default maximum such as `40svh`.
4. Switches `overflow-y` between hidden and auto depending on whether content has reached the cap.
5. Re-runs sizing when the controlled `value`, `defaultValue`, or layout-affecting inputs change.

The component should remain usable as a drop-in textarea. Add an escape hatch prop only if needed to disable autosize or override the max height for a future screen.

### DM Conversation Layout

Update [src/pages/ConversationPage.tsx](/Users/rabble/code/divine/divine-web/.worktrees/fix-dm-composer-autosize/src/pages/ConversationPage.tsx:302) so the composer row:

- Gives the textarea a two-line baseline.
- Keeps the send button bottom-aligned as the textarea grows.
- Relies on the shared textarea autosize behavior instead of page-local resize code.

The existing `handleSend()` contract remains the source of truth for clearing the draft. A successful mutation should continue to reset the controlled value, which will now also reset the autosized height.

## Error Handling

- Failed sends must not clear the DM draft.
- Autosize failures must degrade safely to a normal textarea instead of blocking input.
- If a textarea is empty, its height should return to the measured baseline rather than staying expanded from previous content.

## Scope

In scope:

- Shared textarea autosize behavior
- DM composer two-line baseline
- DM composer reset after successful send
- Tests covering autosize growth and DM reset behavior

Out of scope:

- Rich text, attachments, or composer toolbar changes
- Changing DM send semantics beyond the existing success/failure contract
- Restyling unrelated forms beyond the autosize behavior they inherit from the shared component

## Testing

Add coverage for:

- shared textarea growth from its existing baseline
- shared textarea reset when controlled values are cleared
- shared textarea cap behavior switching to internal scroll
- DM composer clearing and height reset after a successful send
- DM composer preserving the draft after a failed send

Run focused component/page tests first, then run `npm run test`.
