<!-- This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. -->
# Third-party notices (chat POC)

- `nostr-tools` and `@nostrify/nostrify` / `@nostrify/react`: existing project dependencies, reused as-is; no new crypto dependency added. Protocol logic in `src/lib/chat/` reuses `nostr-tools` (`getPublicKey`, NIP-44 conversation keys) via the existing signer/session — no new signer or token store was added.
- `@divinevideo/login` (DivineJWTSigner transport): MIT — copyright preserved in that package.
- Concord protocol module (`src/lib/chat/`): clean-room implementation from the Concord specification text (CORD-01..08, MIT-licensed spec). Final boundary: this module is MPL-2.0 and stays MPL-2.0. No Armada code was copied, vendored, or linked — Armada is AGPL-3.0, and no Armada/Applesauce source is included in this tree. If Armada AGPL code is ever reused, its license notices and corresponding source must be added here before that code lands; until then the clean-room claim stands. The applesauce-concord SDK was not vendored either (license not verified).

## Concord protocol kernel

The files under `src/lib/chat/concord-core` are copied unchanged from
`packages/concord-core/src` in armada-discord-bridge at revision
`3febf95aef198828fc156b08e2bda4b873e55f2a`. They retain that source's
GNU Affero General Public License version 3 terms; the license is included at
`src/lib/chat/concord-core/LICENSE`. This notice does not change Divine Web's
root license or relicense the kernel. The source license difference is a release
consideration for distributions incorporating these modules.
