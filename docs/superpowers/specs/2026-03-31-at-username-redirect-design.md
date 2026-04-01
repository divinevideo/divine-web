# @username Redirect Route

**Date:** 2026-03-31
**Status:** Approved

## Problem

`divine.video/@username` is a natural URL pattern users expect (Twitter, Mastodon, etc.), but it currently falls through to the `/:nip19` catch-all route and shows a 404 since `@username` is not a valid NIP-19 identifier.

## Design

Add a client-side route at `/@:username` that resolves the username via NIP-05 and redirects to the user's subdomain profile.

### Route

React Router v6 does not support literal prefix characters in path patterns (`/@:username` won't match). Instead, `NIP19Page.tsx` detects the `@` prefix on the existing `/:nip19` catch-all and delegates to `AtUsernamePage`.

### Page component: `AtUsernamePage.tsx`

1. Accept `username` as a prop (passed by NIP19Page)
2. If on a subdomain, redirect to `https://divine.video/@{username}` (see Subdomain guard below)
3. Fetch `/.well-known/nostr.json?name={username}` (relative URL)
4. Parse the JSON response for `names[username]` to get the hex pubkey
5. If found: `window.location.href = https://{username}.divine.video`
6. If not found: show "User Not Found" card

### NIP-05 lookup

Use a relative fetch (`/.well-known/nostr.json?name={username}`) rather than hardcoding `divine.video`. On the apex domain (Fastly), this hits the edge worker's `handleNip05()` which does a `?name=` query against the KV store. On CF Pages test domains, NIP-05 returns 404 and the component degrades gracefully to "User Not Found."

The NIP-05 response format is:
```json
{
  "names": {
    "username": "hex-pubkey"
  }
}
```

We only need to check that `names[username]` exists and is a 64-char hex string.

### Redirect behavior

Use `window.location.href` (full navigation, not React Router `navigate()`), consistent with the existing subdomain redirect in ProfilePage (line 156). This is a cross-origin navigation to a different subdomain.

### Subdomain guard

On subdomains (e.g., `alice.divine.video/@bob`), the edge worker's NIP-05 handler returns the subdomain owner's data (`{"names": {"_": "<alice-pubkey>"}}`), not the `?name=` query result. The relative fetch would get the wrong response.

Guard: if `getSubdomainUser()` returns non-null, skip the NIP-05 lookup entirely and redirect to `https://divine.video/@{username}`, where the apex handler resolves it correctly.

### Edge cases

- **Already on a subdomain** (`alice.divine.video/@bob`): Redirects to `divine.video/@bob` first, which then resolves and redirects to `bob.divine.video`.
- **Username not found in NIP-05**: Show "User Not Found" card with the username displayed, matching the UniversalUserPage error pattern.
- **NIP-05 fetch fails** (network error, non-JSON response): Treat as "not found" with a generic error message.
- **Username with special characters**: URL-decode the param before looking up. NIP-05 names are lowercase alphanumeric with underscores and hyphens.

### UI states

- **Loading**: Centered Loader2 spinner with "Looking up @{username}..." (matches UniversalUserPage)
- **Not found**: Card with AlertCircle, "User Not Found" heading, username displayed, "Go to Home" button
- **Redirecting**: Loader2 spinner with "Redirecting to {username}.divine.video..."

### Testing

Unit tests with vitest:
1. Successful lookup redirects (mock fetch, verify `window.location.href` set)
2. Username case normalization (uppercase input lowercased before lookup)
3. Username not in NIP-05 response shows not-found state
4. Fetch failure shows not-found state
5. Invalid pubkey in NIP-05 response shows not-found state
6. Loading state while fetching
7. Subdomain guard redirects to apex without fetching NIP-05

No Fastly changes needed. The route is entirely client-side.

## Files

| File | Change |
|------|--------|
| `src/pages/AtUsernamePage.tsx` | New page component |
| `src/pages/AtUsernamePage.test.tsx` | Tests |
| `src/pages/NIP19Page.tsx` | Detect `@` prefix, delegate to AtUsernamePage |
