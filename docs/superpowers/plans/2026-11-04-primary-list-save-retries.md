# Reliable list saving implementation plan

**Goal:** A list save reports success only after the Divine primary relay accepts the signed event, with bounded retries for transient failures.

**Scope:** Continue PR #758, preserving the reviewer's three pushed fixes. Address its outstanding read-cost, timeout, collaboration, routing, and documentation findings alongside primary acknowledgement.

**Publishing:** Sign once. Send that immutable event directly to the canonical primary with a fresh five-second deadline on each attempt. Retry transient failures twice, after one and two seconds. Do not retry explicit invalid/blocked/restricted/auth-required rejections. After primary acknowledgement, replicate through existing routing without making backup success a requirement. A disabled canonical primary fails saving before signing. Forward event options through the cached client.

**Reading:** Keep author-less discovery on configured, ranked relays. Only author-scoped list recovery and exact list-deletion queries fan out to enabled publish sources. Remove broad deletion discovery; fetch only deletion targets for returned lists. Bound each network phase so a stalled relay cannot consume the whole caller deadline before the deletion check. Share one recent-lists query across card badges. Preserve the previous non-list fallback routing policy.

**Collaboration:** Abort or incomplete participant reads fail mutations before publication. Never fall back to the owner's stale membership after a timed-out participant read.

**Deletion limits:** Owner-scoped deletion matching remains best effort. Local persistent entries expire after the existing two-hour TTL. State these limits rather than claiming permanent cross-session deletion knowledge.

## Tasks

1. Add failing hook/client tests for primary acknowledgement, retry/backoff, one signature, exhausted/permanent failure, disabled primary, backup failure after success, and event-option forwarding. Implement the publish policy in a focused helper and existing hook/client.
2. Add failing tests for shared card queries, author-less routing, bounded read phases with targeted deletion checks, and aborted collaboration reads. Implement the narrow read changes and preserve existing reviewer repairs.
3. Run focused tests, full type/lint/test/build checks, and obtain fresh-context whole-diff review. Update PR #758, explain each review disposition, re-request the reviewer who requested changes, verify CI, and hand back for merge.
