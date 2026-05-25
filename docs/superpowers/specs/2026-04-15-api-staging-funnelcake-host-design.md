# API Staging Funnelcake Host Design

## Goal

Allow the Fastly-cached Funnelcake API to serve both `api.divine.video` and `api.staging.divine.video`, with each hostname proxying to the matching relay origin.

## Scope

- Add explicit API host to Funnelcake origin mapping for the Fastly compute service.
- Extend the web relay helper so staging relay URLs resolve to the staging API hostname.
- Add tests that lock the production and staging mappings in place.

## Design

### Host Mapping

Use an explicit mapping instead of hard-coded production-only strings:

- `api.divine.video` -> `https://relay.divine.video`
- `api.staging.divine.video` -> `https://relay.staging.divine.video`

Unknown hosts should fall back to the production origin so existing behavior stays stable.

### Compute Service

The compute service already derives an effective request host from `X-Original-Host` or `url.hostname`. Reuse that host value to choose the correct Funnelcake origin for every proxied REST read, including feed injection, OG metadata lookups, and user/category fetches.

The Fastly backend stays named `funnelcake`; only the request URL and `Host` header need to change per incoming API hostname.

### Web Client

The relay helper in `src/config/relays.ts` should keep treating Divine relay hosts as Funnelcake-capable, and should additionally rewrite `wss://relay.staging.divine.video` to `https://api.staging.divine.video`.

This keeps staging aligned with the production behavior without requiring each caller to special-case the host pair.

## Testing

- Add a compute-focused unit test for the API host to origin mapping helper.
- Add a relay helper test covering production, staging, and non-Divine relays.
- Run the targeted tests first, then the full repo verification command before finishing.
