---
name: pr-conventions
description: |
  Commit and pull request conventions for divine-web. Load when creating
  commits, writing PR descriptions, or preparing branches for review.
---

# PR Conventions

## Commits

- Imperative, present tense: "Add profile page", not "Added profile page".
- Keep focused on one logical change.
- Reference issue IDs when applicable: "Fix login redirect (#42)".

## PR Titles

Use Conventional Commit format:

```
type(scope): summary
type: summary
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`,
`perf`.

Set the correct title when opening the PR. Editing the title afterward may not
retrigger `semantic_pr.yml`, leaving the check stale or failed.

## PR Description

Fill out `.github/pull_request_template.md` completely. Every section:

- Summary: what the PR does, in a sentence or two.
- Motivation: why the change is needed.
- Related issue: link to the tracking issue, or "N/A".
- Testing checklist: what was verified and how.
- Visuals checklist: screenshots or video for UI changes, or explicitly write
  "no visual change".

## Scope

One PR per concern. Do not bundle:

- Unrelated formatting changes.
- Lockfile churn.
- Drive-by refactors.
- Incidental cleanup discovered during work.

If you spot something worth fixing, file an issue and address it separately.

## Branding Policy

Do not mention corporate partners, customers, brands, campaign names, or other
sensitive external identities in:

- PR titles or descriptions.
- Branch names.
- Screenshots or video.
- Commit messages.

Use generic descriptors instead: "partner subdomain", "brand account",
"external partner". Maintainer approval is required before naming any external
entity.

## Transitional Code

Any temporary or transitional code must include a tracking reference:

```ts
// TODO(#123): remove after migration complete
```

No TODO without an issue number.

## Branch Hygiene

Before opening a PR:

1. Rebase on `origin/main`.
2. Verify `npm run test` passes locally.
3. Ensure clean `git status` (no unstaged or untracked files).

## When to Stop

Stop exploratory UI work if maintainer alignment on scope or UX is missing. Do
not continue speculative feature implementation past the point of uncertainty.
Open a discussion or draft PR to align before proceeding.
