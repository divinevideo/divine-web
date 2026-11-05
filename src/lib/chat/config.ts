/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
export function isChatEnabled(): boolean {
  return Boolean(import.meta.env.VITE_CONCORD_INVITE_URL) || import.meta.env.DEV || import.meta.env.VITE_CHAT_POC_ENABLED === 'true';
}
