<!-- This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. -->
# Third-party notices (chat POC)

- `nostr-tools` and `@nostrify/nostrify` / `@nostrify/react`: existing project dependencies, reused as-is; no new crypto dependency added. Protocol logic in `src/lib/chat/` reuses `nostr-tools` (`getPublicKey`, NIP-44 conversation keys) via the existing signer/session — no new signer or token store was added.
- `@divinevideo/login` (DivineJWTSigner transport): MIT — copyright preserved in that package.
- Legacy Concord POC protocol (`src/lib/chat/protocol.ts`): clean-room implementation from the MIT-licensed Concord specification text (CORD-01..08), retained under MPL-2.0. The real community adapter now uses the separately licensed upstream kernel documented below. The applesauce-concord SDK is not vendored.

## Concord protocol kernel

The files under `src/lib/chat/concord-core` are copied unchanged from
`packages/concord-core/src` in armada-discord-bridge at revision
`3febf95aef198828fc156b08e2bda4b873e55f2a`. They retain that source's
GNU Affero General Public License version 3 terms; the license is included at
`src/lib/chat/concord-core/LICENSE`. This notice does not change Divine Web's
root license or relicense the kernel. The source license difference is a release
consideration for distributions incorporating these modules.
