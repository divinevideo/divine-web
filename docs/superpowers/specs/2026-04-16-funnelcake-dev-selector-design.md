# Funnelcake Developer Selector Design

## Goal

Give developers a small in-app debug control that switches Funnelcake REST reads between automatic hostname-based routing, forced production, and forced staging.

## Scope

- Add a resolver for the effective Funnelcake API base URL.
- Persist a developer-selected mode in `localStorage`.
- Expose a compact selector in the existing moderation debug panel.
- Invalidate relevant React Query caches when the mode changes so subsequent REST reads use the new host.

## Design

### Modes

The selector will support three modes:

- `auto`: follow the app hostname
- `production`: always use `https://api.divine.video`
- `staging`: always use `https://api.staging.divine.video`

`auto` resolves as:

- `staging.divine.video` -> `https://api.staging.divine.video`
- all other hostnames -> `https://api.divine.video`

### Resolver

Move Funnelcake base URL selection behind a small resolver in `src/config/api.ts`. Code that currently reads `API_CONFIG.funnelcake.baseUrl` should instead read the resolved value so the same logic applies everywhere.

The effective base URL should be chosen in this order:

1. Developer override mode from `localStorage`
2. Hostname-based `auto` mode
3. Environment fallback only when needed for nonstandard deployments

### UI Placement

Use the existing debug panel on the moderation settings page. It already has a “Show Debug Info” control, so adding the developer selector there avoids exposing new settings to normal users.

The panel should show:

- current mode
- effective Funnelcake base URL
- a short note that changing the selector affects future REST reads

### Cache Behavior

When the mode changes, invalidate common Funnelcake-backed queries so the next fetch reflects the new base URL. The invalidation should be broad enough to refresh search/profile/feed REST reads without requiring a full page reload.

## Testing

- Add resolver tests for all three modes and hostname behaviors.
- Add a moderation settings page test covering the debug selector and persistence.
- Run targeted tests first, then the full `npm test` suite.
