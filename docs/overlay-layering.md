# Overlay Layering Strategy

This document defines the layering ownership model for shared Radix overlays and nested combinations.

## Canonical Tokens

Use `src/lib/overlayLayers.ts` as the single source of truth:

- `OVERLAY_LAYERS.floating` (`z-50`)
- `OVERLAY_LAYERS.toast` (`z-[100]`)
- `OVERLAY_LAYERS.overlay` (`z-[200]`)
- `OVERLAY_LAYERS.nestedOverlayFloating` (`z-[210]`)

## Layer Hierarchy

From lowest to highest:

1. Floating surfaces (`SelectContent`, `PopoverContent`, `TooltipContent`, `HoverCardContent`, `AlertDialog`)
2. Toast viewport
3. Overlay containers (`DropdownMenu`, `Dialog`, `Sheet`)
4. Nested floating content that must stay above its parent overlay (instance-level override only)

## Ownership Rules

1. Shared primitives keep conservative defaults from the token map.
2. Do not raise a shared primitive globally to fix a local nesting bug.
3. For nested portal overlays (example: `Select` inside `DropdownMenu`), apply `nestedOverlayFloating` on the specific instance.
4. Document any new layer before introducing a new z-index class.

## Nested Overlay Pattern

Use an instance-level class override on the nested content:

```tsx
<RelaySelector
  className="w-full"
  contentClassName={OVERLAY_LAYERS.nestedOverlayFloating}
/>
```

`RelaySelector` forwards `contentClassName` to `SelectContent`, so only this nesting path is elevated.

## Regression Coverage

- `src/components/auth/AccountSwitcher.test.tsx`
  - Guards that `AccountSwitcher` passes `OVERLAY_LAYERS.nestedOverlayFloating` to the nested `RelaySelector`.
  - Prevents future regressions where the local override is removed and someone re-introduces a global `Select` z-index bump.
