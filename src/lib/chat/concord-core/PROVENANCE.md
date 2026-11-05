# Concord protocol kernel

These TypeScript modules are copied unchanged from `packages/concord-core/src`
at armada-discord-bridge revision `3febf95aef198828fc156b08e2bda4b873e55f2a`.
The sibling `LICENSE` retains that repository's GNU AGPL version 3 terms.
Keep this source available with distributions containing these modules.

Only the transitive module closure used by Divine's community client is included.
Changes to protocol authorization belong upstream, then come here as a verified
source update. `community-interop.json` is the bridge-generated synthetic fixture
for this kernel revision; it contains disposable public read material only.
The interop, lifecycle and control-parity fixture generators and matching JSON
copies live under `scripts/fixtures/` and `test-fixtures/concord/` at bridge
revision `54fc8e880d67`. That later fixture revision leaves this kernel unchanged;
the JSON `sourceRevision` records the kernel, not the generator revision.

The web adapter deliberately bypasses process-wide decode caches so decrypted
state is confined to the signed-in account. It uses the unchanged owner-rooted
fold, channel binding, stream verification, moderation and timeline functions.
