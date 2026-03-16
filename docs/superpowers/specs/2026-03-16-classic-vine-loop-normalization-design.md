# Classic Vine Loop Normalization Design

## Summary

Classic Vine videos currently arrive from some Funnelcake endpoints with two competing count sources:

- `raw.loops`, which can now reflect small new diVine loop activity such as `0`, `1`, or `2`
- archived Vine loop counts embedded in `content` or `title`, such as `Original stats: 14,890,612 loops`

The frontend still treats `video.loopCount` as the archived Vine total. That mismatch causes classic Vine surfaces to briefly or permanently show the smaller modern count instead of the preserved legacy total.

## Goal

Normalize classic Vine loop data app-wide so every surface that renders `video.loopCount` shows the larger archived Vine loop count, while keeping new diVine views available separately through `video.divineViewCount`.

## Scope

In scope:

- Funnelcake transform logic for classic Vine videos
- any merge path that can overwrite normalized loop counts later
- tests covering classic and non-classic video transforms

Out of scope:

- redesigning profile stats layout
- introducing a new dedicated legacy loop field across the app
- changing how non-classic videos render counts

## Current Behavior

The transform layer currently assigns:

- `loopCount = raw.loops ?? parsedOriginalStats ?? 0`
- `divineViewCount = raw.views ?? 0`

For `/api/users/{pubkey}/videos`, this is no longer safe for classic videos because `raw.loops` may be a tiny modern activity count while the archived Vine total only survives inside `content`.

Downstream consumers including the profile page, grid badges, video cards, fullscreen feed, and verification details assume `loopCount` is the legacy Vine number.

## Proposed Design

### Data Contract

For classic Vine videos only, derive a canonical loop count as the maximum of:

- the API-provided `raw.loops`
- the archived Vine loop count parsed from `content`
- the archived Vine loop count parsed from `title`

Assign that canonical value to `video.loopCount`.

Keep `video.divineViewCount` mapped from `raw.views` so UIs that show combined reach can continue using:

- archived Vine loops from `video.loopCount`
- new diVine views from `video.divineViewCount`

### Transform Rules

For classic Vine videos:

1. Parse archived loop candidates from `content` and `title`
2. Compare those values with `raw.loops`
3. Store the largest value in `video.loopCount`

For non-classic videos:

1. Preserve current behavior
2. Do not infer archived counts from free text

### Merge Rules

Any stats merge helper that writes `loopCount` back onto a video must preserve the normalized classic value. It must not replace a large archived loop count with a smaller live metric for classic Vine videos.

## Files Likely Affected

- `src/lib/funnelcakeTransform.ts`
- `src/lib/funnelcakeTransform.test.ts`
- `src/types/funnelcake.ts` or nearby comments if API semantics need clarification

Potential review target:

- `src/lib/funnelcakeClient.ts` if merge-path semantics need to be documented

## Error Handling

If archived loop parsing fails, the transform should fall back to the existing numeric source without throwing.

If all classic loop sources are missing, the transformed video should keep `0`.

## Testing Strategy

Add failing tests first for:

1. classic Vine payload where `raw.loops` is smaller than the archived count in `content`
2. classic Vine payload where `raw.loops` already matches or exceeds parsed archived counts
3. non-classic payload to confirm text parsing does not alter normal videos
4. merge behavior for classic videos if a helper can overwrite normalized loop counts

Verification after implementation:

- targeted Vitest coverage for transform behavior
- full `npm test`

## Success Criteria

- Classic Vine profile totals use preserved legacy loop counts instead of tiny modern loop counters
- Grid, feed, fullscreen, and video detail surfaces continue to show the larger archived loop total
- New diVine view counts remain available separately and are not lost by normalization
