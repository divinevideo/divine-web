# Invite-First Web Auth Launch Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current web waitlist/login funnel with an invite-first flow that validates invites via `invite.divine.video`, redirects mainstream users to `login.divine.video`, keeps advanced Nostr login as a secondary path, and gives local-`nsec` users a visible backup/secure-account path without invite friction.

**Architecture:** `divine-web` becomes the invite gate, waitlist UI, local-key detector, and post-auth hydrator. `invite.divine.video` remains the invite system of record. `login.divine.video` owns credential UI for sign-up/sign-in and BYOK secure-account, while `divine-web` reuses the existing Nostr login storage/cross-subdomain auth plumbing after the user returns.

**Tech Stack:** React 18, TypeScript, React Router, React Query, `@nostrify/react/login`, `nostr-tools`, `keycast-login`, Vitest, Testing Library

---

## File Structure

### Create

- `src/lib/inviteApi.ts`
- `src/lib/inviteApi.test.ts`
- `src/lib/authHandoff.ts`
- `src/lib/authHandoff.test.ts`
- `src/lib/localNsecAccount.ts`
- `src/lib/localNsecAccount.test.ts`
- `src/lib/divineLogin.ts`
- `src/lib/divineLogin.test.ts`
- `src/pages/AuthCallbackPage.tsx`
- `src/pages/AuthCallbackPage.test.tsx`
- `src/components/auth/InviteCodeForm.tsx`
- `src/components/auth/WaitlistForm.tsx`
- `src/components/auth/LocalNsecBanner.tsx`

### Modify

- `package.json`
- `src/AppRouter.tsx`
- `src/main.tsx`
- `src/components/auth/LoginArea.tsx`
- `src/components/auth/LoginDialog.tsx`
- `src/components/auth/AccountSwitcher.tsx`
- `src/contexts/LoginDialogContext.tsx`
- `src/lib/crossSubdomainAuth.ts`
- `src/hooks/useLoginActions.ts`

### Delete or retire

- `src/components/auth/SignupDialog.tsx`
  - Remove from public flow. If the file is still useful during rollout, leave it unused temporarily but do not keep it wired into `LoginArea`.

### External contract to confirm before merge

- `login.divine.video` route(s) for standard signup/sign-in and secure-account/BYOK entry
- invite handoff cookie name/shape/TTL acceptance
- callback redirect target back into `divine-web`
- invite consumption after signup success

---

## Chunk 1: Invite and Handoff Primitives

### Task 1: Add the invite service client and normalized models

**Files:**
- Create: `src/lib/inviteApi.ts`
- Test: `src/lib/inviteApi.test.ts`

- [ ] **Step 1: Write the failing tests for client-config, validate, and waitlist parsing**

```ts
expect(await getInviteClientConfig()).toEqual({
  mode: 'invite_code_required',
  waitlistEnabled: true,
  supportEmail: 'support@divine.video',
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/lib/inviteApi.test.ts`  
Expected: FAIL because `inviteApi.ts` does not exist yet

- [ ] **Step 3: Implement the minimal invite client**

```ts
export async function getInviteClientConfig() { /* GET /v1/client-config */ }
export async function validateInviteCode(code: string) { /* POST /v1/validate */ }
export async function joinInviteWaitlist(contact: string) { /* POST /v1/waitlist */ }
```

- [ ] **Step 4: Re-run the targeted test**

Run: `vitest run src/lib/inviteApi.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/inviteApi.ts src/lib/inviteApi.test.ts
git commit -m "Add invite API client for web auth launch"
```

### Task 2: Add short-lived cross-subdomain invite handoff helpers

**Files:**
- Create: `src/lib/authHandoff.ts`
- Test: `src/lib/authHandoff.test.ts`

- [ ] **Step 1: Write the failing tests for handoff cookie creation, parsing, expiry, and clearing**

```ts
setInviteHandoff({ code: 'ABCD-EFGH', mode: 'signup' });
expect(readInviteHandoff()?.code).toBe('ABCD-EFGH');
clearInviteHandoff();
expect(readInviteHandoff()).toBeNull();
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/lib/authHandoff.test.ts`  
Expected: FAIL because `authHandoff.ts` does not exist yet

- [ ] **Step 3: Implement the cookie helper**

```ts
export function setInviteHandoff(payload: InviteHandoffPayload): void;
export function readInviteHandoff(now = Date.now()): InviteHandoffPayload | null;
export function clearInviteHandoff(): void;
```

- [ ] **Step 4: Re-run the targeted test**

Run: `vitest run src/lib/authHandoff.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/authHandoff.ts src/lib/authHandoff.test.ts
git commit -m "Add invite handoff cookie helpers"
```

### Task 3: Add local-`nsec` detection and export helpers

**Files:**
- Create: `src/lib/localNsecAccount.ts`
- Test: `src/lib/localNsecAccount.test.ts`
- Modify: `src/hooks/useLoginActions.ts`

- [ ] **Step 1: Write the failing tests for detecting active local `nsec` logins and exporting backup content**

```ts
expect(getActiveLocalNsecLogin(mockLogins)?.type).toBe('nsec');
expect(buildNsecDownload('nsec1example')).toContain('nsec1example');
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/lib/localNsecAccount.test.ts`  
Expected: FAIL because helper file does not exist yet

- [ ] **Step 3: Implement the helper module**

```ts
export function getActiveLocalNsecLogin(logins: NLoginType[]): NsecLogin | null;
export function getStoredLocalNsecLogin(storageKey = 'nostr:login'): NsecLogin | null;
export function buildNsecDownload(nsec: string): string;
```

- [ ] **Step 4: Add the smallest `useLoginActions` helper needed for exporting the current `nsec` safely**

```ts
export function useLoginActions() {
  // existing methods...
  exportCurrentNsec(): string | null;
}
```

- [ ] **Step 5: Re-run the targeted test**

Run: `vitest run src/lib/localNsecAccount.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/localNsecAccount.ts src/lib/localNsecAccount.test.ts src/hooks/useLoginActions.ts
git commit -m "Add local nsec detection and export helpers"
```

---

## Chunk 2: Login Redirect and Callback Plumbing

### Task 4: Add the `login.divine.video` OAuth wrapper

**Files:**
- Modify: `package.json`
- Create: `src/lib/divineLogin.ts`
- Test: `src/lib/divineLogin.test.ts`

- [ ] **Step 1: Add the failing tests for standard signup URL generation, BYOK URL generation, and callback parsing**

```ts
expect(await buildSignupRedirect()).toMatchObject({ url: expect.stringContaining('login.divine.video') });
expect(await buildSecureAccountRedirect('nsec1example')).toMatchObject({ url: expect.stringContaining('byok_pubkey=') });
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/lib/divineLogin.test.ts`  
Expected: FAIL because wrapper file and dependency are missing

- [ ] **Step 3: Add the dependency and wrapper**

```ts
import { createKeycastClient } from 'keycast-login';

export async function buildSignupRedirect(): Promise<{ url: string }>;
export async function buildSecureAccountRedirect(nsec: string): Promise<{ url: string }>;
export function parseDivineLoginCallback(url: string): CallbackResult;
```

- [ ] **Step 4: Re-run the targeted test**

Run: `vitest run src/lib/divineLogin.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/divineLogin.ts src/lib/divineLogin.test.ts
git commit -m "Add divine login redirect helpers"
```

### Task 5: Add a callback route that hydrates login on return from `login.divine.video`

**Files:**
- Create: `src/pages/AuthCallbackPage.tsx`
- Test: `src/pages/AuthCallbackPage.test.tsx`
- Modify: `src/AppRouter.tsx`
- Modify: `src/lib/crossSubdomainAuth.ts`

- [ ] **Step 1: Write the failing route test for successful callback handling**

```tsx
renderWithRouter('/auth/callback?code=test-code&state=test-state');
await screen.findByText(/Finishing sign-in/i);
expect(mockLoginBunker).toHaveBeenCalled();
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/pages/AuthCallbackPage.test.tsx`  
Expected: FAIL because route/page does not exist yet

- [ ] **Step 3: Implement the callback page**

```tsx
export default function AuthCallbackPage() {
  // parse callback
  // exchange code
  // save Keycast session + bunker URL
  // add bunker login
  // clear invite handoff
  // redirect to app
}
```

- [ ] **Step 4: Wire the route into `AppRouter.tsx`**

```tsx
<Route path="/auth/callback" element={<AuthCallbackPage />} />
```

- [ ] **Step 5: Extend cross-subdomain auth only if needed for the returned bunker login shape**

Run: `vitest run src/lib/crossSubdomainAuth.test.ts src/pages/AuthCallbackPage.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/AuthCallbackPage.tsx src/pages/AuthCallbackPage.test.tsx src/AppRouter.tsx src/lib/crossSubdomainAuth.ts src/lib/crossSubdomainAuth.test.ts
git commit -m "Add login callback route for web auth launch"
```

---

## Chunk 3: Replace the Public Auth Funnel

### Task 6: Rebuild `LoginDialog` as an invite-first state machine

**Files:**
- Modify: `src/components/auth/LoginDialog.tsx`
- Create: `src/components/auth/InviteCodeForm.tsx`
- Create: `src/components/auth/WaitlistForm.tsx`
- Test: `src/components/auth/LoginDialog.test.tsx` (create if missing)

- [ ] **Step 1: Write failing component tests for the new invite-first states**

```tsx
expect(screen.getByText(/Continue with invite code/i)).toBeInTheDocument();
expect(screen.getByText(/Join the waitlist/i)).toBeInTheDocument();
expect(screen.queryByText(/Login with Extension/i)).not.toBeVisible();
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/components/auth/LoginDialog.test.tsx`  
Expected: FAIL against the current extension/key/bunker-first dialog

- [ ] **Step 3: Implement the dialog state machine**

States to support:
- loading invite client config
- invite code entry
- waitlist fallback
- advanced login disclosure

- [ ] **Step 4: Keep advanced Nostr login methods but move them behind a secondary disclosure**

Supported methods to preserve:
- extension
- bunker
- existing `nsec` paste/file login

- [ ] **Step 5: Re-run the targeted test**

Run: `vitest run src/components/auth/LoginDialog.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/LoginDialog.tsx src/components/auth/InviteCodeForm.tsx src/components/auth/WaitlistForm.tsx src/components/auth/LoginDialog.test.tsx
git commit -m "Refactor login dialog to invite-first flow"
```

### Task 7: Remove HubSpot/public waitlist wiring from `LoginArea`

**Files:**
- Modify: `src/components/auth/LoginArea.tsx`
- Modify: `src/main.tsx`
- Delete or retire: `src/components/auth/SignupDialog.tsx`

- [ ] **Step 1: Write the failing test for `LoginArea` opening only the invite-first dialog**

```tsx
render(<LoginArea />);
await user.click(screen.getByRole('button', { name: /log in/i }));
expect(screen.queryByText(/Get Early Access/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/components/auth/LoginArea.test.tsx`  
Expected: FAIL because `SignupDialog` is still wired in

- [ ] **Step 3: Remove the public `SignupDialog` path and repoint any `#signup` deep link handling to the invite-first dialog**

- [ ] **Step 4: Re-run the targeted test**

Run: `vitest run src/components/auth/LoginArea.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/LoginArea.tsx src/main.tsx src/components/auth/LoginArea.test.tsx src/components/auth/SignupDialog.tsx
git commit -m "Remove HubSpot waitlist wiring from web auth"
```

---

## Chunk 4: Local-`nsec` Backup and Signed-In Surfaces

### Task 8: Add the visible inline local-`nsec` banner

**Files:**
- Create: `src/components/auth/LocalNsecBanner.tsx`
- Modify: `src/components/auth/LoginDialog.tsx`
- Modify: `src/components/auth/AccountSwitcher.tsx`
- Test: `src/components/auth/LocalNsecBanner.test.tsx`

- [ ] **Step 1: Write the failing component test for the banner CTA set**

```tsx
expect(screen.getByRole('button', { name: /Secure with divine.video login/i })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /Back up nsec/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/components/auth/LocalNsecBanner.test.tsx`  
Expected: FAIL because banner component does not exist yet

- [ ] **Step 3: Implement the reusable banner**

Behavior:
- show when current login is local `nsec`
- render inline, not as a takeover
- support secure-account CTA and local backup CTA

- [ ] **Step 4: Mount the banner in the two real surfaces**

Locations:
- inside the invite-first dialog if local `nsec` is detected in a public-entry state
- inside `AccountSwitcher` for signed-in local-`nsec` users

- [ ] **Step 5: Re-run the targeted test**

Run: `vitest run src/components/auth/LocalNsecBanner.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/LocalNsecBanner.tsx src/components/auth/LocalNsecBanner.test.tsx src/components/auth/LoginDialog.tsx src/components/auth/AccountSwitcher.tsx
git commit -m "Add local nsec backup banner to auth surfaces"
```

### Task 9: Hook the banner up to local backup and secure-account redirect

**Files:**
- Modify: `src/components/auth/LocalNsecBanner.tsx`
- Modify: `src/lib/divineLogin.ts`
- Modify: `src/lib/localNsecAccount.ts`
- Test: `src/components/auth/LocalNsecBanner.test.tsx`

- [ ] **Step 1: Write the failing tests for backup download/copy and secure-account redirect start**

```tsx
await user.click(screen.getByRole('button', { name: /Back up nsec/i }));
expect(mockClipboardWrite).toHaveBeenCalledWith('nsec1...');

await user.click(screen.getByRole('button', { name: /Secure with divine.video login/i }));
expect(mockLocationAssign).toHaveBeenCalledWith(expect.stringContaining('login.divine.video'));
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `vitest run src/components/auth/LocalNsecBanner.test.tsx`  
Expected: FAIL because CTA behavior is not wired yet

- [ ] **Step 3: Implement local backup behavior**

Allowed outputs:
- copy to clipboard
- download `.txt`
- explicit reveal only if needed for user confirmation

- [ ] **Step 4: Implement BYOK secure-account redirect start**

Guardrails:
- no `nsec` in URL
- preserve current local login until callback success

- [ ] **Step 5: Re-run the targeted test**

Run: `vitest run src/components/auth/LocalNsecBanner.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/LocalNsecBanner.tsx src/components/auth/LocalNsecBanner.test.tsx src/lib/divineLogin.ts src/lib/localNsecAccount.ts
git commit -m "Wire local nsec backup and secure-account actions"
```

---

## Chunk 5: Final Verification and Launch Hardening

### Task 10: Clean up copy, regression coverage, and run full verification

**Files:**
- Modify: any touched auth files from previous chunks
- Optional doc update: `docs/superpowers/specs/2026-03-23-invite-first-web-auth-launch-design.md`

- [ ] **Step 1: Add or update regression tests for the end-to-end auth states**

Coverage to add:
- invite validation failure stays in dialog
- waitlist fallback uses `invite.divine.video`
- advanced login methods still work
- signed-in local `nsec` account still sees backup banner

- [ ] **Step 2: Run the focused auth test set**

Run:
```bash
vitest run \
  src/lib/inviteApi.test.ts \
  src/lib/authHandoff.test.ts \
  src/lib/localNsecAccount.test.ts \
  src/lib/divineLogin.test.ts \
  src/pages/AuthCallbackPage.test.tsx \
  src/components/auth/LoginDialog.test.tsx \
  src/components/auth/LocalNsecBanner.test.tsx \
  src/components/auth/LoginArea.test.tsx
```

Expected: PASS

- [ ] **Step 3: Run the full project verification**

Run: `npm run test`  
Expected: PASS (warnings already seen on baseline may remain if unchanged)

- [ ] **Step 4: Manual QA checklist**

Verify in browser:
- valid invite -> redirect to `login.divine.video`
- invalid invite -> inline error
- no invite -> waitlist join
- advanced login methods still accessible
- local `nsec` login -> backup banner visible
- secure-account CTA starts redirect without exposing `nsec`

- [ ] **Step 5: Final commit**

```bash
git add package.json package-lock.json src docs/superpowers/specs/2026-03-23-invite-first-web-auth-launch-design.md
git commit -m "Implement invite-first web auth launch"
```

---

## Execution Notes

- Start from the clean worktree branch created for this work.
- Keep commits small and chunk-aligned.
- Do not remove advanced Nostr login support.
- Do not introduce a new browser-only account creation path.
- Treat the `login.divine.video` contract as an external dependency: if route names differ, centralize that change in `src/lib/divineLogin.ts` rather than scattering URL logic.

Plan complete and saved to `docs/superpowers/plans/2026-03-23-invite-first-web-auth-launch.md`. Ready to execute?
