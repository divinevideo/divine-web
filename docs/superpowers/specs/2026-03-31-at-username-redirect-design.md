# @username Redirect Route

**Date:** 2026-03-31
**Status:** Approved

## Problem

`divine.video/@username` is a natural URL pattern users expect (Twitter, Mastodon, etc.), but it currently falls through to the `/:nip19` catch-all route and shows a 404 since `@username` is not a valid NIP-19 identifier.

## Design

Add a client-side route at `/@:username` that resolves the username via NIP-05 and redirects to the user's subdomain profile.

### Route

New route `/@:username` in `AppRouter.tsx`, placed above the `/:nip19` catch-all inside the `AppLayout` routes.

### Page component: `AtUsernamePage.tsx`

1. Extract `username` from route params
2. Fetch `/.well-known/nostr.json?name={username}` (relative URL)
3. Parse the JSON response for `names[username]` to get the hex pubkey
4. If found: `window.location.href = https://{username}.divine.video`
5. If not found: show "User Not Found" card

### NIP-05 lookup

Use a relative fetch (`/.well-known/nostr.json?name={username}`) rather than hardcoding `divine.video`. This means the lookup works against whatever host is serving the app, making it testable on CI test URLs and local dev without Fastly.

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

### Edge cases

- **Already on a subdomain** (`alice.divine.video/@bob`): Redirects to `bob.divine.video`. Correct behavior -- explicit intent to visit another user.
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
2. Username not in NIP-05 response shows not-found state
3. Fetch failure shows not-found state
4. URL-encoded usernames are decoded before lookup

No Fastly changes needed. The route is entirely client-side.

## Files

| File | Change |
|------|--------|
| `src/pages/AtUsernamePage.tsx` | New page component |
| `src/pages/AtUsernamePage.test.tsx` | Tests |
| `src/AppRouter.tsx` | Add `/@:username` route |
