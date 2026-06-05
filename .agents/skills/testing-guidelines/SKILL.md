---
name: testing-guidelines
description: |
  Testing conventions for divine-web. Load when writing or modifying tests, or
  when verifying changes with Vitest or Playwright.
---

# Testing Guidelines

## Frameworks and Setup

Unit tests use Vitest with jsdom. Component tests use
`@testing-library/react`. Global setup lives in `src/test/setup.ts`.

Test files colocate with source: `*.test.ts` for utilities, `*.test.tsx` for
components.

## Running Tests

- `npm run test` runs type-check, lint, vitest, and build. Use this before
  pushing.
- `vitest run` for tests only.
- `vitest` for watch mode during development.
- `npm run test:visual` runs Playwright visual regression tests.
- `npm run test:visual:update` updates visual snapshots.

## Assertion Style

Favor user-facing assertions: `getByRole`, `getByText`, `getByLabelText`,
`getByPlaceholderText`. Query by what the user sees and interacts with.

Avoid testing implementation details. No direct state access. No querying by
`data-testid` unless no user-facing alternative exists.

## Mocking

Mock browser APIs (`window.location`, `fetch`, `IntersectionObserver`, etc.) as
needed. Use `vi.fn()` for spies and `vi.mock()` for module mocks. Keep mocks
minimal and scoped to the test file. Reset mocks between tests with
`vi.restoreAllMocks()` or per-test cleanup.

## Determinism

Tests must be deterministic. No relying on real timers, network calls, or
shared mutable state. Use `vi.useFakeTimers()` for time-dependent logic.
Isolate each test so it can run independently in any order.

## Rules

- Do not commit failing tests. Fix before pushing.
- Add or update tests alongside any feature change or bug fix. Tests are not
  optional.
- If a test is temporarily skipped, it must have a linked issue:
  `it.skip('description #123')`.
