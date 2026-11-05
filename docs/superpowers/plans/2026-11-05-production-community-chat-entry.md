# Production community chat entry implementation plan

**Goal:** Expose the existing real-community chat adapter in production when the approved public invite is configured, without a POC release flag.

**Architecture:** Share the route/navigation build gate, while retaining the existing fail-closed real invite loader. Pass the public GitHub Actions variable only into the normal production build; previews retain their POC configuration. No invite values or signing material are committed, configured, or published by this task.

**Spec:** Maintainer-approved real community go-live direction and the verified missing production route/build variable.

- [x] Test the actual router in production mode with a synthetic invite, without an invite, and with the existing preview gate.
- [x] Add the shared entry gate, desktop sidebar and mobile More-menu entry; exercise navigation and invalid real invite failure behavior.
- [x] Wire `vars.VITE_CONCORD_INVITE_URL` into the production build and guard production/preview separation with a workflow test.
- [x] Exercise a production bundle against synthetic signed community fixtures in a local browser, without external messages.
- [x] Document public-variable setup and the normal main deployment after private acceptance/approval, then run bounded unit tests, lint, types, build, and analytics guards.
- [x] Commit focused changes and hand back the frozen local head for independent review before any GitHub publication.

Capability acceptance also requires real-only canonical continuation routes and an account-scoped in-memory verified selection above route changes. Those are included, with direct switch/logout and stale callback fencing; no persistent capability cache was added.
