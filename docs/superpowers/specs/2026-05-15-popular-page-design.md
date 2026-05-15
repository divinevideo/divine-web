# Popular Page Design

## Context

Divine Web needs a dedicated `/popular` destination for posts that are getting watched on Divine. Funnelcake now exposes the needed API surface on `/api/v2/videos`: `sort=popular`, `period=now|today|week|month|all`, `platform=vine`, and `exclude_platform=vine`.

This page should default to fresh native Divine posts, while still letting people switch to classic Vine archive posts or a mixed feed. It should reuse the existing feed stack so playback, pagination, moderation filtering, author enrichment, ProofMode enrichment, and compilation navigation remain consistent with the rest of the app.

## Goals

- Add a shareable `/popular` app route.
- Default `/popular` to New + Now.
- Let users switch source: New, Classic, All.
- Let users switch period: Now, Today, Week, Month, All time.
- Use Funnelcake v2 popular period feeds rather than relay-side search sorting.
- Keep `/trending` intact in this pass.

## Non-Goals

- Do not replace `/trending` or redirect it.
- Do not change Search sort behavior from divine-web#365.
- Do not rank classic all-time by original Vine archive loop counts on this page.
- Do not add a separate popular API client/hook if the existing feed pipeline can be extended cleanly.

## Route And State

Add `PopularPage` at `/popular` under the normal `AppLayout`.

The page owns two URL-backed controls:

- `source`: `new | classic | all`, default `new`
- `period`: `now | today | week | month | all`, default `now`

Default values are omitted from the URL:

- `/popular` means `source=new&period=now`
- `/popular?source=classic` means `source=classic&period=now`
- `/popular?period=week` means `source=new&period=week`
- `/popular?source=all&period=month` means mixed source for the month period

Invalid query params fall back to defaults and replace the URL with the canonical form.

## API Mapping

The page always uses `/api/v2/videos` through `fetchVideosV2`.

Popular parameters map as follows:

| UI state | API params |
| --- | --- |
| New + `<period>` | `sort=popular&period=<period>&exclude_platform=vine` |
| Classic + `<period>` | `sort=popular&period=<period>&platform=vine` |
| All + `<period>` | `sort=popular&period=<period>` |

Classic + All time remains `sort=popular&period=all&platform=vine`. It means Divine-era popularity for archived Vines, not original Vine loop-count ordering. Original loop-count ordering belongs in existing classics/archive surfaces.

Pagination uses the v2 envelope's opaque `pagination.next_cursor`, matching the current trending v2 implementation.

## Feed Architecture

Use option 1 from the design discussion: extend the existing feed stack.

Data flow:

1. `PopularPage` parses and controls `source` and `period`.
2. `PopularPage` renders `VideoFeed feedType="popular"` with popular options.
3. `VideoFeed` passes those options into `useVideoProvider`.
4. `useVideoProvider` treats popular as Funnelcake-only canonical Divine API data.
5. `useInfiniteVideosFunnelcake` maps popular options into `fetchVideosV2`.
6. `transformToVideoPage` converts the v2 response into the shared video page shape.

Popular should not silently widen an empty slice. If New + Now returns no videos, show the existing empty state and let the visible controls explain what slice is selected.

## UI

The page should be a feed page, not a dashboard.

Header:

- Title: `Popular`
- Subheading changes with selected state, for example:
  - New + Now: `Fresh Divine posts getting watched now.`
  - Classic + Week: `Classic Vines getting watched this week.`
  - All + Month: `Everything Divine watched this month.`

Controls:

- First pill row: New, Classic, All.
- Second pill row: Now, Today, Week, Month, All time.
- Use the prominent pill-row pattern from divine-web#365 and existing Trending/Discovery pages.
- Avoid hiding period in a dropdown; both dimensions should be visible.

Feed:

- Render the standard `VideoFeed` card stack below the controls.
- Use a distinct accent if useful, but stay within the existing brand component system.

Navigation:

- Add `Popular` to desktop sidebar near `Discover`.
- Use a Phosphor icon such as `TrendUp` or `Flame`.
- Add i18n keys for visible copy and nav text.

## Error And Empty States

Use existing `VideoFeed` loading, empty, and error behavior.

Do not auto-switch to another source or period on error or empty results. The selected controls should remain stable so the URL, API request, and visible state always match.

## Relationship To Existing Work

divine-web#365 is related only as a UI pattern. It changes Search sort pills and defaults, but it does not touch `VideoFeed`, routes, Funnelcake video listing, or `/api/v2/videos`.

This popular page uses `/api/v2/videos`, which has live support for `sort=popular`, `period`, `platform`, and `exclude_platform`. It is not blocked by the `/api/v2/search` backend sort issue called out in divine-web#365.

## Testing

Add focused tests for:

- `PopularPage` defaults to New + Now when no query params exist.
- Clicking source and period pills updates selection and URL params.
- Default query params are omitted from the canonical URL.
- Invalid query params normalize to New + Now.
- Popular feed options map to `fetchVideosV2` params:
  - New => `exclude_platform=vine`
  - Classic => `platform=vine`
  - All => no platform filter
  - Period is passed through unchanged.
- Pagination passes through v2 opaque cursors.

Existing shared feed behavior should remain covered by current `VideoFeed` and provider tests.
