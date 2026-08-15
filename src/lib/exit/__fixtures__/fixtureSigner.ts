// ABOUTME: Deterministic NIP-98 signer used by owner-export tests
// ABOUTME: Records every signed URL so cursor walks can be asserted

import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";

import { fixturePubkey } from "./exportFixtures";

export class FixtureSigner implements NostrSigner {
  public readonly signedUrls: string[] = [];

  async getPublicKey(): Promise<string> {
    return fixturePubkey;
  }

  async signEvent(event: Omit<NostrEvent, "id" | "pubkey" | "sig">): Promise<NostrEvent> {
    const url = event.tags.find(([name]) => name === "u")?.[1];
    if (url) {
      this.signedUrls.push(url);
    }

    return {
      id: "9999999999999999999999999999999999999999999999999999999999999999",
      pubkey: fixturePubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      sig: "88888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888"
    };
  }
}
