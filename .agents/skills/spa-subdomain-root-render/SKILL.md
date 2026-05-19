---
name: spa-subdomain-root-render
description: |
  Render a page component directly at subdomain root (/) without URL redirect in React Router SPAs.
  Use when: (1) Subdomain should show content at / instead of redirecting to /profile/id or similar,
  (2) User sees blank page because component relies on useParams() but there's no route param at /,
  (3) Want username.domain.com/ to feel like a personal website without /profile/xyz in the URL.
  Pattern involves edge-injected global data + component fallback to that data when route params missing.
author: Claude Code
version: 1.0.0
date: 2026-02-03
---

# SPA Subdomain Root Render Without Redirect

## Problem
When building subdomain-based routing (e.g., `username.example.com`), using React Router's
`<Navigate to="/profile/username" replace />` changes the URL, which defeats the purpose
of having a clean subdomain URL. Additionally, the target component may show a blank page
if it relies on `useParams()` to get route parameters that don't exist at `/`.

## Context / Trigger Conditions
- Subdomain profile page redirects to `/profile/npub1...` instead of serving content at `/`
- Page appears blank (no content loads) on subdomain root
- Component uses `useParams()` and fails when rendered at a route without those params
- Edge worker injects user data into `window.__SUBDOMAIN_USER__` or similar global
- Want `username.domain.com/` to render like a personal website

## Solution

### 1. Router: Render Component Directly Instead of Navigate

**Before (causes redirect + URL change):**
```tsx
<Route path="/" element={
  subdomainUser
    ? <Navigate to={`/profile/${subdomainUser.npub}`} replace />
    : <Index />
} />
```

**After (renders at / without URL change):**
```tsx
<Route path="/" element={
  subdomainUser
    ? <ProfilePage />
    : <Index />
} />
```

### 2. Component: Add Fallback Data Source

The component must check for injected subdomain data when route params are missing.

**Before (only checks route params):**
```tsx
export function ProfilePage() {
  const { npub } = useParams<{ npub?: string }>();
  const identifier = npub;

  if (!identifier) {
    return <Error message="No user identifier provided" />;
  }
  // ... rest of component
}
```

**After (falls back to injected data):**
```tsx
import { getSubdomainUser } from '@/hooks/useSubdomainUser';

export function ProfilePage() {
  const { npub } = useParams<{ npub?: string }>();
  const subdomainUser = getSubdomainUser();

  // Route param takes priority, subdomain data is fallback
  const identifier = npub || subdomainUser?.npub;

  if (!identifier) {
    return <Error message="No user identifier provided" />;
  }
  // ... rest of component
}
```

### 3. Edge Worker: Inject User Data into HTML

The edge worker (Fastly Compute, Cloudflare Workers, etc.) should inject user data:

```javascript
// In edge worker handling subdomain
const userData = await fetchUserData(username);
const html = await fetchSpaHtml();

const injectedHtml = html.replace(
  '</head>',
  `<script>window.__DIVINE_USER__ = ${JSON.stringify(userData)};</script></head>`
);

return new Response(injectedHtml, { headers: { 'content-type': 'text/html' } });
```

### 4. Client-Side Data Access

```typescript
// useSubdomainUser.ts
interface SubdomainUser {
  subdomain: string;
  pubkey: string;
  npub: string;
  username?: string;
  displayName?: string;
  // ... other fields
}

export function getSubdomainUser(): SubdomainUser | null {
  if (typeof window === 'undefined') return null;
  return (window as any).__DIVINE_USER__ || null;
}
```

## Verification
1. Visit `username.domain.com/` - URL should stay at `/`, not redirect
2. Profile content should load correctly
3. Check browser console for no errors about missing identifiers
4. Verify `window.__DIVINE_USER__` contains expected data in devtools

## Example
For divine-web:
- `thecomedianriley.divine.video/` renders ProfilePage at `/`
- ProfilePage checks `useParams()` first (empty at `/`)
- Falls back to `getSubdomainUser()?.npub` from injected data
- Profile loads without URL change

## Notes
- This pattern requires coordination between edge worker and client code
- Edge worker must inject data before SPA hydration
- Always check route params first for normal `/profile/:npub` routes to work
- Consider SEO: the edge worker should also set appropriate meta tags
- Links on the subdomain can use `SmartLink` component to stay local for owner's content
  but link to apex domain for other users' content

## References
- React Router v6 Routes: https://reactrouter.com/en/main/route/route
- Fastly Compute@Edge: https://developer.fastly.com/learning/compute/
