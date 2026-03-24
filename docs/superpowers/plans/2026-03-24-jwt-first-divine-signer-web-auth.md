# JWT-First Divine Signer Web Auth Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate standard `login.divine.video` web auth to JWT-first REST signing so the callback flow and logged-in app state no longer depend on bunker connection.

**Architecture:** Reuse the existing `KeycastJWTSigner` and JWT session storage as the primary auth path for normal web users. Make `useCurrentUser()` and related account UI derive logged-in state from the JWT session first, preserve manual nostr-login accounts as fallback, and simplify the OAuth callback so it only hydrates the token session before redirecting.

**Tech Stack:** React 18, TypeScript, `@divinevideo/login`, `@nostrify/react`, Vitest, Testing Library

---

## File Structure

### Modify

- `src/pages/AuthCallbackPage.tsx`
  - Remove bunker-first callback hydration and make OAuth success persist JWT state then redirect immediately.
- `src/pages/AuthCallbackPage.test.tsx`
  - Prove callback success no longer depends on `loginActions.bunker()`.
- `src/hooks/useCurrentUser.ts`
  - Add JWT-first current-user resolution while preserving manual-login fallback behavior.
- `src/hooks/useCurrentUser.test.ts`
  - Cover JWT-backed user selection, precedence, and fallback rules.
- `src/App.tsx`
  - Mount the JWT `window.nostr` compatibility component at the app root.
- `src/components/KeycastJWTWindowNostr.test.tsx`
  - Confirm root-mounted usage assumptions still hold.
- `src/components/auth/LoginArea.tsx`
  - Treat JWT-backed auth as logged in for the header/login button surface.
- `src/hooks/useLoggedInAccounts.ts`
  - Expose JWT-backed current-account state for the account menu when a JWT session exists.
- `src/components/auth/AccountSwitcher.tsx`
  - Make logout clear JWT-backed session state instead of only removing nostr-login entries.
- `src/components/auth/LoginArea.test.tsx`
  - Cover JWT-backed logged-in presentation.

### Possibly modify depending on test pressure

- `src/hooks/useNostrPublish.ts`
  - Only if tests reveal signer assumptions that reject the JWT-backed user shape.
- `src/hooks/useKeycastSession.ts`
  - Only if logout/session helpers need a small API adjustment for clearer JWT-first semantics.

### No change expected

- `src/lib/divineLogin.ts`
  - OAuth exchange contract already returns the token needed for JWT-first auth.
- `src/components/auth/LoginDialog.tsx`
  - Entry points already redirect correctly and should not need structural changes for this migration.
- `src/hooks/useLoginActions.ts`
  - Manual advanced bunker/extension/nsec login flow remains intact.

---

## Chunk 1: Callback No Longer Depends On Bunker

### Task 1: Lock the callback regression with tests

**Files:**
- Modify: `src/pages/AuthCallbackPage.test.tsx`
- Test: `src/pages/AuthCallbackPage.test.tsx`

- [ ] **Step 1: Write the failing test that callback success redirects without bunker login**

```tsx
mockExchangeDivineLoginCallback.mockResolvedValue({
  bunkerUri: 'bunker://ignored',
  returnPath: '/home',
  token: 'jwt-token',
});

render(
  <MemoryRouter initialEntries={['/auth/callback?code=test-code&state=test-state']}>
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/home" element={<div>Home Route</div>} />
    </Routes>
  </MemoryRouter>,
);

await screen.findByText('Home Route');

expect(mockSaveSession).toHaveBeenCalledWith('jwt-token', null, false);
expect(mockBunker).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the targeted callback test to verify it fails**

Run: `npx vitest run src/pages/AuthCallbackPage.test.tsx`
Expected: FAIL because the callback still awaits bunker login

- [ ] **Step 3: Implement the minimal callback change**

```tsx
if (result.token) {
  saveSession(result.token, null, false);
}

clearInviteHandoff();
navigate(result.returnPath || '/home', { replace: true });
```

- [ ] **Step 4: Re-run the targeted callback test to verify it passes**

Run: `npx vitest run src/pages/AuthCallbackPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/AuthCallbackPage.tsx src/pages/AuthCallbackPage.test.tsx
git commit -m "Make divine auth callback JWT-first"
```

---

## Chunk 2: JWT-First Current User Resolution

### Task 2: Add failing tests for JWT-backed current-user selection

**Files:**
- Modify: `src/hooks/useCurrentUser.test.ts`
- Test: `src/hooks/useCurrentUser.test.ts`

- [ ] **Step 1: Write the failing test for JWT-backed user without manual logins**

```ts
mockGetValidToken.mockReturnValue('jwt-token');
mockJwtSigner.getPublicKey.mockResolvedValue('a'.repeat(64));

const { result } = renderHook(() => useCurrentUser());

await waitFor(() => {
  expect(result.current.user?.pubkey).toBe('a'.repeat(64));
});
expect(result.current.signer).toBe(mockJwtSigner);
```

- [ ] **Step 2: Write the failing test for JWT precedence over manual logins**

```ts
mockGetValidToken.mockReturnValue('jwt-token');
mockLogins.push(extensionLogin('manual-pubkey'));

const { result } = renderHook(() => useCurrentUser());

await waitFor(() => {
  expect(result.current.user?.pubkey).toBe('jwt-pubkey');
});
```

- [ ] **Step 3: Run the targeted hook test to verify it fails**

Run: `npx vitest run src/hooks/useCurrentUser.test.ts`
Expected: FAIL because `useCurrentUser()` only reads nostr-login state today

- [ ] **Step 4: Implement the minimal JWT-first hook behavior**

```ts
const token = getValidToken();
const jwtSigner = useMemo(() => token ? new KeycastJWTSigner({ token }) : null, [token]);
const jwtPubkey = useAsyncValue(jwtSigner?.getPublicKey());

if (jwtSigner && jwtPubkey) {
  return {
    user: { pubkey: jwtPubkey, signer: jwtSigner } as NUser,
    users: [{ pubkey: jwtPubkey, signer: jwtSigner } as NUser],
    signer: jwtSigner,
    ...author.data,
  };
}
```

- [ ] **Step 5: Re-run the targeted hook test to verify it passes**

Run: `npx vitest run src/hooks/useCurrentUser.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCurrentUser.ts src/hooks/useCurrentUser.test.ts
git commit -m "Prefer JWT-backed current user for web auth"
```

### Task 3: Keep manual accounts as fallback

**Files:**
- Modify: `src/hooks/useCurrentUser.ts`
- Modify: `src/hooks/useCurrentUser.test.ts`
- Test: `src/hooks/useCurrentUser.test.ts`

- [ ] **Step 1: Add the failing fallback test**

```ts
mockGetValidToken.mockReturnValue(null);
setNostrProvider();
mockLogins.push(extensionLogin('manual-pubkey'));

const { result } = renderHook(() => useCurrentUser());

expect(result.current.user?.pubkey).toBe('manual-pubkey');
expect(result.current.signer).toBeDefined();
```

- [ ] **Step 2: Run the targeted hook test to verify the fallback case fails or regresses**

Run: `npx vitest run src/hooks/useCurrentUser.test.ts`
Expected: FAIL or regression until fallback logic is wired correctly

- [ ] **Step 3: Implement minimal fallback-preserving logic**

```ts
if (jwtUser) {
  return jwtResult;
}

return manualLoginResult;
```

- [ ] **Step 4: Re-run the targeted hook test to verify it passes**

Run: `npx vitest run src/hooks/useCurrentUser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCurrentUser.ts src/hooks/useCurrentUser.test.ts
git commit -m "Keep manual signer fallback for current user"
```

---

## Chunk 3: Mount JWT Compatibility At The App Root

### Task 4: Mount the JWT compatibility component from `App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/KeycastJWTWindowNostr.test.tsx`
- Test: `src/components/KeycastJWTWindowNostr.test.tsx`

- [ ] **Step 1: Write the failing test that app root includes the JWT compatibility component**

```tsx
render(<App />);

expect(screen.queryByTestId('keycast-jwt-window-nostr')).toBeInTheDocument();
```

- [ ] **Step 2: Run the targeted component test to verify it fails**

Run: `npx vitest run src/components/KeycastJWTWindowNostr.test.tsx`
Expected: FAIL because `App.tsx` does not mount the component

- [ ] **Step 3: Implement the minimal app-root mount**

```tsx
<NostrProvider>
  <KeycastJWTWindowNostr />
  <EventCachePreloader />
  <SentryUserSync />
```

- [ ] **Step 4: Re-run the targeted component test to verify it passes**

Run: `npx vitest run src/components/KeycastJWTWindowNostr.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/KeycastJWTWindowNostr.test.tsx
git commit -m "Mount JWT window.nostr compatibility at app root"
```

---

## Chunk 4: JWT-Aware Login Surface And Logout

### Task 5: Make the login area treat JWT auth as logged in

**Files:**
- Modify: `src/components/auth/LoginArea.tsx`
- Modify: `src/hooks/useLoggedInAccounts.ts`
- Modify: `src/components/auth/LoginArea.test.tsx`
- Test: `src/components/auth/LoginArea.test.tsx`

- [ ] **Step 1: Write the failing test for JWT-backed logged-in presentation**

```tsx
mockUseLoggedInAccounts.mockReturnValue({
  currentUser: { id: 'jwt:a', pubkey: 'a'.repeat(64), metadata: {} },
  otherUsers: [],
});

render(<LoginArea />);

expect(screen.queryByRole('button', { name: /Log in/i })).not.toBeInTheDocument();
expect(screen.getByRole('button')).toBeInTheDocument();
```

- [ ] **Step 2: Run the targeted login-area test to verify it fails**

Run: `npx vitest run src/components/auth/LoginArea.test.tsx`
Expected: FAIL until JWT-backed current user can flow through the account hook

- [ ] **Step 3: Implement the minimal JWT-aware current-account behavior**

```ts
if (jwtUser) {
  return {
    authors: [jwtAccount],
    currentUser: jwtAccount,
    otherUsers: [],
    setLogin,
    removeLogin,
  };
}
```

- [ ] **Step 4: Re-run the targeted login-area test to verify it passes**

Run: `npx vitest run src/components/auth/LoginArea.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLoggedInAccounts.ts src/components/auth/LoginArea.tsx src/components/auth/LoginArea.test.tsx
git commit -m "Treat JWT web auth as logged in in login area"
```

### Task 6: Make account logout clear JWT session state

**Files:**
- Modify: `src/components/auth/AccountSwitcher.tsx`
- Possibly modify: `src/hooks/useKeycastSession.ts`
- Test: `src/components/auth/LoginArea.test.tsx` or a new account-switcher test file

- [ ] **Step 1: Write the failing logout test for JWT-backed sessions**

```tsx
await user.click(screen.getByRole('menuitem', { name: /Log out/i }));

expect(mockClearSession).toHaveBeenCalled();
expect(mockRemoveLogin).not.toHaveBeenCalledWith('jwt:current');
```

- [ ] **Step 2: Run the targeted logout test to verify it fails**

Run: `npx vitest run src/components/auth/LoginArea.test.tsx`
Expected: FAIL because logout currently removes a nostr-login entry only

- [ ] **Step 3: Implement the minimal JWT logout path**

```tsx
if (currentUser.id.startsWith('jwt:')) {
  clearSession();
  clearLoginCookie();
  return;
}

removeLogin(currentUser.id);
```

- [ ] **Step 4: Re-run the targeted logout test to verify it passes**

Run: `npx vitest run src/components/auth/LoginArea.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/AccountSwitcher.tsx src/components/auth/LoginArea.test.tsx src/hooks/useKeycastSession.ts
git commit -m "Clear JWT session on web auth logout"
```

---

## Chunk 5: Verification

### Task 7: Verify the JWT-first web-auth path

**Files:**
- No additional source changes expected

- [ ] **Step 1: Run focused callback and current-user tests**

Run:

```bash
npx vitest run \
  src/pages/AuthCallbackPage.test.tsx \
  src/hooks/useCurrentUser.test.ts
```

Expected: PASS

- [ ] **Step 2: Run focused app/login surface tests**

Run:

```bash
npx vitest run \
  src/components/KeycastJWTWindowNostr.test.tsx \
  src/components/auth/LoginArea.test.tsx
```

Expected: PASS

- [ ] **Step 3: Run broader auth regression checks**

Run:

```bash
npx vitest run \
  src/lib/divineLogin.test.ts \
  src/components/auth/LoginDialog.test.tsx
```

Expected: PASS

- [ ] **Step 4: Run full project verification**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Confirm the working tree is clean**

Run: `git status --short`
Expected: no output
