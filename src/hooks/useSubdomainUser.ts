/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ABOUTME: Hook to handle subdomain user profiles (username.divine.video)
// ABOUTME: Reads window.__DIVINE_USER__ injected by the edge worker and provides user context

export interface SubdomainUser {
  subdomain: string;
  pubkey: string;
  npub: string;
  username: string;
  displayName: string;
  picture: string | null;
  banner: string | null;
  about: string | null;
  nip05: string;
  followersCount: number;
  followingCount: number;
  videoCount: number;
  apexDomain: string;
}

declare global {
  interface Window {
    __DIVINE_USER__?: SubdomainUser;
  }
}

/**
 * Get the subdomain user data if present.
 * This is injected by the Fastly edge worker when serving username.divine.video
 */
export function getSubdomainUser(): SubdomainUser | null {
  if (typeof window !== 'undefined' && window.__DIVINE_USER__) {
    return window.__DIVINE_USER__;
  }
  return null;
}

/**
 * Check if we're on a subdomain profile page
 */
export function isSubdomainProfile(): boolean {
  return getSubdomainUser() !== null;
}

/**
 * Get the profile path to navigate to for the subdomain user
 */
export function getSubdomainProfilePath(): string | null {
  const user = getSubdomainUser();
  if (!user) return null;
  return `/profile/${user.npub}`;
}
