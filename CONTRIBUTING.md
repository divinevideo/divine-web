# Contributing to Divine Web

_Thank you_ for wanting to help keep the Web weird, with short form, human-grade
and made video.

This guide is the source of truth for contributors. If you are working with an
agent (Codex, Claude, ChatGPT, Cursor, Copilot, or anything else that writes
code for you), make sure it reads this file and `AGENTS.md` before touching
anything.

## Current Contribution Status

We welcome pull requests. Bug fixes, documentation improvements, targeted
tests, and small scoped polish are always open without pre-approval.

For anything that touches product direction, user experience, or architecture
decisions, check with a maintainer first. A quick comment on an issue or a
message in the project channel is enough to get alignment before you spend time
on code.

We may close large unsolicited feature branches. That is a sequencing call, not
a judgment on your effort. We would rather help you find the right scope than
review a 2,000-line PR that restructures the app.

## Good First Contributions

Good places to start:

- Small bug fixes with a clear reproduction and a narrow diff
- Targeted test coverage for existing code
- Documentation fixes or clarifications
- Small refactors that a maintainer has explicitly asked for
- Scoped UI polish where the design direction is already settled

These are not good first contributions unless a maintainer asked for them:

- New features or product surfaces
- Broad UX overhauls
- Multi-page flows or navigation changes
- New storage, caching, or state management layers
- "I implemented the whole issue" PRs without prior confirmation

When in doubt, ask first. We are happy to point you at work that matches your
comfort level.

## Before You Start

Run through this checklist before writing any code:

1. A maintainer has indicated this work is wanted right now (via an issue, a
   comment, or a direct request). See [Current Contribution Status](#current-contribution-status).
2. The product behavior and design direction are clear enough to implement
   without guessing.
3. You can deliver the change as a small, focused PR (or a series of PRs).
4. You know which module or file owns the change.
5. You can run `npm run test` locally and it passes on your machine.

If any of these are unclear, start a discussion on the issue or reach out to a
maintainer. Five minutes of alignment saves hours of rework.

## Templates And Agent Compliance

Read `AGENTS.md`. If you are using an agent to write code, make sure it has
read `AGENTS.md`, this file, and any relevant docs before generating anything.

Use the GitHub issue and PR templates. PR titles must follow Conventional
Commit format (see [Pull Requests](#pull-requests) for details). Set the
correct title when you open the PR.

Submissions that ignore templates, skip repo instructions, or disregard the
guidelines in `AGENTS.md` may be closed without detailed explanation.

## Technical Debt Standard

**We hold a higher bar in the age of agentic programming**. No new technical
debt - clean up debt in areas you touch.

This means no TODOs, no compatibility shims, no temporary hacks, no
commented-out code, no partial migrations, and no "fix later" scaffolding
without explicit maintainer approval. If your change needs new mess to ship now,
rescope the change instead.

**Agent use is not an excuse for larger diffs with lower standards**. The diff
should be exactly what a careful human would write, no more.

## Why PRs Get Closed

We close PRs for sequencing reasons, not to be dismissive. Common reasonable causes:

- Work started without maintainer alignment on scope or direction
- Feature direction is still unsettled
- Branch is too large or touches too many concerns
- The PR solves the wrong problem or solves a problem that does not exist yet
- Feature work is mixed with unrelated cleanup, formatting churn, or experiments
- The change introduces new technical debt
- The review cost exceeds what the team can absorb right now

If your PR gets closed, it means "not now, not like this." Ask a maintainer how
to reshape the work and try again.

## Repository Setup

Prerequisites:

- Node.js 20.11
- npm 11

Steps:

```sh
git clone https://github.com/divinevideo/divine-web.git
cd divine-web
npm install
```

Run `npm run dev` to verify the dev server starts on `http://localhost:8080`.

## Where To Work

Source lives in `src/`. The directory structure:

- [`src/components/`](./src/components/) for React components
- [`src/pages/`](./src/pages/) for page-level components (named `*Page.tsx`)
- [`src/hooks/`](./src/hooks) for custom hooks
- [`src/lib/`](./src/lib) for utilities and shared logic
- [`src/contexts/`](./src/contexts/) for React contexts
- [`src/types/`](./src/types/) for TypeScript type definitions

The flow from the application shell to the page component is `index.html` (app
shell) then `src/main.tsx` then `src/App.tsx` then `src/AppRouter.tsx` (root
router).

Trust the current implementation and focused tests over stale historical docs -
**the code is what's running**. If code and docs disagree, _the code wins_.

Useful reading:

- [`docs/relay-architecture.md`](./docs/relay-architecture.md) for relay and Nostr relay details
- [`docs/caching-strategy.md`](./docs/caching-strategy.md) for client-side caching approach
- [`docs/brand/`](./docs/brand/) for voice, tone, and visual identity

## Architecture Expectations

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full picture. The short version:

- [React 18](https://18.react.dev/) with TypeScript throughout
- [TailwindCSS](https://tailwindcss.com/) with
  [`tailwind-merge`](https://github.com/dcastil/tailwind-merge) for style
  composition and conflict resolution
- Custom hooks and contexts for state management
- [nostrify](https://nostrify.dev/) for Nostr protocol integration
- Import app code via the `@/` alias (configured in `tsconfig` and Vite)

## Product And Design Boundaries

Do not assume that old issues, Figma files, comment threads, or dormant
branches authorize implementing a feature. **The source of truth for product
direction is current maintainer direction**.

If your change affects any of the following, get explicit confirmation first:

- Navigation model or routing
- Feed structure or content ordering
- Auth flows or session handling
- Search and discovery surfaces
- Storage semantics or persistence behavior
- Subdomain routing
- Any UI that needs design fidelity

If the direction is unresolved, stop and ask. Implementing something and hoping
for approval is how PRs get closed.

## Day-To-Day Commands

| Command               | What it does                                 |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Starts dev server on `http://localhost:8080` |
| `npm run test`        | Type-check, lint, unit tests, then build     |
| `npm run build`       | Production build (outputs to `dist/`)        |
| `vitest run`          | Unit tests only                              |
| `npm run test:visual` | Playwright visual tests                      |
| `eslint`              | Lint only                                    |

Run `npm run test` before pushing. If it fails locally, it will fail in CI.

## Testing Expectations

We use Vitest with `@testing-library/react` and jsdom. Test setup lives in
`src/test/setup.ts`.

Place tests next to the code they cover (`*.test.ts` or `*.test.tsx`). Favor
user-facing assertions over implementation details. Keep tests deterministic.
Mock browser APIs as needed.

Run [`npm run test:visual`](#day-to-day-commands) when changing UI. Visual tests
use Playwright and catch regressions that unit tests miss.

Do not push red tests. Do not skip tests to make the suite pass. If a test is
wrong, fix the test. If the test is right, fix the code.

## Scope Discipline

Keep PRs focused and reviewable. A PR should do one thing. If you find yourself
doing two things, open two PRs.

Do:

- Change only what the task requires
- Stage only task-related files
- Keep dependency changes narrow and justified
- Split independent work into separate PRs

Do not:

- Mix feature work with unrelated cleanup, version bumps, or formatting changes
- Add speculative architecture or "while I was here" improvements
- Land partial work with TODOs for "the rest later" (see [Technical Debt Standard](#technical-debt-standard))
- Leave the branch dirty at handoff

## Pull Requests

Requirements:

- PR title in Conventional Commit format: `type(scope): summary` or
  `type: summary`. Set the correct title when opening the PR (edits may not
  retrigger the semantic PR check).
- Target the `main` branch
- Fill out `.github/pull_request_template.md` completely
- Clean git status (no unstaged or untracked files)
- Rebase on `origin/main` before pushing
- One PR per issue when possible

Before opening, make sure you have followed [Scope Discipline](#scope-discipline)
and `npm run test` passes locally.

UI changes must include screenshots or video in the PR, or explicitly state
that there is no visual change.

Do not mention corporate partners, customers, brands, campaign names, or other
sensitive external identities in public PR titles, branch names, screenshots, or
descriptions unless a maintainer explicitly approves it. Use generic descriptors
like "partner subdomain" or "brand account" instead.

## Documentation Rules

Current documentation lives in `docs/`. Historical plans are preserved but
marked as historical. Before writing a new doc, check whether existing docs
already cover the topic.

If you are changing behavior that is documented, update the docs in the same PR.
If the docs are wrong, fix them. If the docs are missing, add them.
