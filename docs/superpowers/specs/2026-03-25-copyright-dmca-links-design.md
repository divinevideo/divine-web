# Copyright & DMCA Link Restore Design

## Summary

The app still serves the `/dmca` route, but the primary navigation surfaces that should expose it have drifted. The footer no longer includes a `Copyright & DMCA` entry, and the authenticated legal-navigation cluster in the sidebar and mobile header menu also omits it.

## Problem

- `src/components/AppFooter.tsx` exposes other legal links but no longer includes a direct path to `/dmca`.
- `src/components/AppSidebar.tsx` groups legal and project links under "Terms & Open Source" but does not surface `/dmca`.
- `src/components/AppHeader.tsx` mirrors that sidebar group for mobile navigation and is also missing `/dmca`.
- The FAQ already links to `/dmca`, and that wording should remain unchanged.

## Goals

- Restore a visible `Copyright & DMCA` link in the footer.
- Add the same destination to the authenticated legal links in both the desktop sidebar and the mobile header menu.
- Preserve the existing FAQ `DMCA policy` wording and route target.
- Add regression coverage so future navigation edits catch this omission.

## Non-Goals

- Renaming legal copy across the rest of the site.
- Changing the `/dmca` page content or route.
- Refactoring shared navigation into a new abstraction.

## Decision

Make a minimal navigation-only change. Add a `Copyright & DMCA` link pointing to `/dmca` in the footer legal row, the desktop sidebar legal group, and the mobile header dropdown legal group. Keep the FAQ untouched, but cover the existing `/dmca` FAQ link in tests so the current wording remains intentional.

## Expected Behavior

1. The public footer shows `Copyright & DMCA` alongside the other legal links.
2. Logged-in users can reach `/dmca` from the desktop sidebar legal group.
3. Mobile users can reach `/dmca` from the header dropdown legal group.
4. The FAQ still exposes the existing `DMCA policy` link to `/dmca`.

## Test Strategy

- Add focused component tests for the footer, sidebar, and mobile header dropdown that assert a `/dmca` link with the expected label is rendered.
- Add or update FAQ coverage to assert the existing `DMCA policy` link to `/dmca` remains present.
- Run the focused tests first, then run `npm run test` for full verification.
