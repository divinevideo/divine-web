# Restrict protected-minor DMs to HQ/Support on web (divine-web#454)

**Status:** WIP stub — design pending the official-identity trust-model
decision (divine-mobile#4948). Web sibling of divine-mobile#5754; the resolved
design will land here mirroring the mobile spec.

**Part of:** support-trust-safety#176 / epic support-trust-safety#173.

## Blocked on

- divine-mobile#4948: how clients pin the authoritative Divine HQ/Support
  identity set (pin vs NIP-05 vs hybrid). support-trust-safety#176 is
  blocked-by that decision; this branch stakes the web implementation slot.

## Shape (to be confirmed by the decision)

- Send-block: a protected minor cannot compose DMs to non-official npubs.
- Inbound filter: DMs from non-official senders are not surfaced.
- Client-side by necessity (NIP-17 gift-wraps hide sender from the relay).
- Official set consumed via whatever mechanism #4948 lands.
