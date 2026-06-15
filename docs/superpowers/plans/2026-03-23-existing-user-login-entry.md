# Existing User Login Entry Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clear existing-account sign-in entry point to the invite-first auth dialog while preserving invite-gated registration for new users.

**Architecture:** Extend the existing `login.divine.video` wrapper with a dedicated sign-in redirect helper, then update the auth dialog to render two first-class entry points on the default surface. Keep invite validation and waitlist behavior attached only to the signup path, and preserve the current callback hydration flow.

**Tech Stack:** React 18, TypeScript, `@divinevideo/login`, Vitest, Testing Library

---

## File Structure

### Modify

- `src/lib/divineLogin.ts`
  - Add a dedicated existing-account redirect helper that uses the same state and return-path plumbing as signup without forcing register mode.
- `src/lib/divineLogin.test.ts`
  - Add focused redirect-helper coverage for existing-account sign-in intent and return-path persistence.
- `src/components/auth/LoginDialog.tsx`
  - Add the explicit existing-account action and keep it available during invite-service degradation.
- `src/components/auth/LoginDialog.test.tsx`
  - Cover the new button, the direct redirect behavior, and the degraded invite-service path.

### No change expected

- `src/lib/authHandoff.ts`
- `src/pages/AuthCallbackPage.tsx`
- `src/components/auth/WaitlistForm.tsx`
- `src/components/auth/LocalNsecBanner.tsx`

---

## Chunk 1: Redirect Helper

### Task 1: Add a dedicated existing-account redirect helper

**Files:**
- Modify: `src/lib/divineLogin.ts`
- Test: `src/lib/divineLogin.test.ts`

- [ ] **Step 1: Write the failing tests for existing-account redirect intent and return-path storage**

```ts
const redirect = await buildLoginRedirect({ returnPath: '/messages' });

expect(redirect.url).toContain('https://login.divine.video');
expect(mockGetAuthorizationUrl).toHaveBeenCalledWith({});
expect(localStorage.getItem('divine:return-path:login-state')).toBe('/messages');
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/lib/divineLogin.test.ts`  
Expected: FAIL because `buildLoginRedirect` does not exist yet

- [ ] **Step 3: Implement the minimal redirect helper**

```ts
export async function buildLoginRedirect(
  options?: { returnPath?: string },
): Promise<DivineLoginRedirect> {
  const client = createClient();
  const { url } = await client.oauth.getAuthorizationUrl({});
  const state = readStateFromRedirect(url);

  storeReturnPath(state, options?.returnPath);

  return { state, url };
}
```

- [ ] **Step 4: Re-run the targeted test to verify it passes**

Run: `vitest run src/lib/divineLogin.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/divineLogin.ts src/lib/divineLogin.test.ts
git commit -m "Add existing-account divine login redirect"
```

---

## Chunk 2: Dialog Entry Points

### Task 2: Add a visible existing-account action to the default auth surface

**Files:**
- Modify: `src/components/auth/LoginDialog.tsx`
- Test: `src/components/auth/LoginDialog.test.tsx`

- [ ] **Step 1: Write the failing test for the explicit existing-account button**

```tsx
render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

await screen.findByRole('button', { name: /Continue with invite code/i });
expect(screen.getByRole('button', { name: /I already have an account/i })).toBeInTheDocument();
```

- [ ] **Step 2: Write the failing test for direct existing-account redirect without invite validation**

```tsx
await user.click(screen.getByRole('button', { name: /I already have an account/i }));

await waitFor(() => {
  expect(mockBuildLoginRedirect).toHaveBeenCalledWith({ returnPath: '/' });
  expect(mockValidateInviteCode).not.toHaveBeenCalled();
  expect(locationAssign).toHaveBeenCalledWith('https://login.divine.video/api/oauth/authorize?client_id=divine-web');
});
```

- [ ] **Step 3: Run the targeted test to verify it fails**

Run: `vitest run src/components/auth/LoginDialog.test.tsx`  
Expected: FAIL because the existing-account action is not rendered or wired yet

- [ ] **Step 4: Implement the minimal dialog changes**

```tsx
const handleExistingAccountLogin = async () => {
  setIsLoginLoading(true);
  setConfigError(null);

  try {
    const returnPath = `${window.location.pathname}${window.location.search}`;
    const redirect = await buildLoginRedirect({ returnPath });
    window.location.assign(redirect.url);
  } catch (caughtError) {
    setConfigError(caughtError instanceof Error ? caughtError.message : 'Unable to start sign-in');
    setIsLoginLoading(false);
  }
};
```

- [ ] **Step 5: Re-run the targeted test to verify it passes**

Run: `vitest run src/components/auth/LoginDialog.test.tsx`  
Expected: PASS for the new existing-account cases

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/LoginDialog.tsx src/components/auth/LoginDialog.test.tsx
git commit -m "Add explicit existing-account login entry"
```

### Task 3: Keep existing-account sign-in available when invite config fails

**Files:**
- Modify: `src/components/auth/LoginDialog.tsx`
- Test: `src/components/auth/LoginDialog.test.tsx`

- [ ] **Step 1: Write the failing degraded-state test**

```tsx
mockGetInviteClientConfig.mockRejectedValue(new Error('Invite service unavailable'));

render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

await screen.findByText(/Invite service unavailable/i);
expect(screen.getByRole('button', { name: /I already have an account/i })).toBeInTheDocument();
```

- [ ] **Step 2: Extend that test to prove the button still redirects**

```tsx
await user.click(screen.getByRole('button', { name: /I already have an account/i }));

await waitFor(() => {
  expect(mockBuildLoginRedirect).toHaveBeenCalled();
  expect(locationAssign).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the targeted test to verify it fails**

Run: `vitest run src/components/auth/LoginDialog.test.tsx`  
Expected: FAIL because degraded invite mode currently removes the primary path entirely

- [ ] **Step 4: Implement the degraded-state rendering**

```tsx
{configError ? (
  <div className="space-y-3">
    <div className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
      Invite sign-up is unavailable right now.
    </div>
    <Button onClick={handleExistingAccountLogin} type="button">
      I already have an account
    </Button>
  </div>
) : (
  // normal invite-first surface
)}
```

- [ ] **Step 5: Re-run the targeted test to verify it passes**

Run: `vitest run src/components/auth/LoginDialog.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/LoginDialog.tsx src/components/auth/LoginDialog.test.tsx
git commit -m "Keep existing-account sign-in available during invite outages"
```

---

## Chunk 3: Verification

### Task 4: Verify the focused auth surface behavior end to end

**Files:**
- No additional source changes expected

- [ ] **Step 1: Run the focused redirect and dialog tests**

Run:

```bash
vitest run \
  src/lib/divineLogin.test.ts \
  src/components/auth/LoginDialog.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run the broader auth callback regression check**

Run:

```bash
vitest run \
  src/pages/AuthCallbackPage.test.tsx \
  src/components/auth/LoginArea.test.tsx
```

Expected: PASS

- [ ] **Step 3: Run full project verification**

Run: `npm run test`  
Expected: PASS

- [ ] **Step 4: Commit the verification checkpoint if any plan-tracking/doc updates were made**

```bash
git status --short
```

Expected: clean working tree
