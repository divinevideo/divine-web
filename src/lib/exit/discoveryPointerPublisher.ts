// ABOUTME: Signs account-move pointers once and publishes them across discovery relays
// ABOUTME: Keeps pre-publication failures separate from per-relay outcomes

import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";

import { openDestinationRelay } from "./relayConnection";
import type { PointerPublishTarget } from "./discoveryPointers";
import type { EventTemplate } from "./eventRewrite";

export interface PointerToSign {
  kind: number;
  label: string;
  template: EventTemplate;
}

export interface SignedPointer {
  kind: number;
  label: string;
  event: NostrEvent;
}

export interface PointerPreparationFailure {
  kind: number;
  label: string;
  status: "blocked" | "signing-failed";
  reason: string;
}

export interface PointerRelayResult {
  kind: number;
  label: string;
  relay: string;
  isDiscoveryRelay: boolean;
  status: "published" | "duplicate" | "publish-failed";
  reason?: string;
}

export type DiscoveryPointerResult = PointerPreparationFailure | PointerRelayResult;

export interface DiscoveryPointerSummary {
  kind: number;
  label: string;
  status: "published" | "destination-only" | "failed" | "blocked" | "signing-failed";
  acceptedRelays: string[];
  acceptedDiscoveryRelays: string[];
  totalRelays: number;
  totalDiscoveryRelays: number;
  failures: Array<{ relay?: string; reason: string }>;
}

export async function prepareSignedPointers(input: {
  pointers: PointerToSign[];
  signer: NostrSigner;
  ownerPubkey: string;
}): Promise<{ signed: SignedPointer[]; failures: PointerPreparationFailure[] }> {
  const signed: SignedPointer[] = [];
  const failures: PointerPreparationFailure[] = [];

  for (const pointer of input.pointers) {
    try {
      const event = await input.signer.signEvent(pointer.template);
      if (event.pubkey !== input.ownerPubkey) {
        throw new Error("The signer returned an event for a different account.");
      }
      signed.push({ kind: pointer.kind, label: pointer.label, event });
    } catch (error) {
      const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
      failures.push({
        kind: pointer.kind,
        label: pointer.label,
        status: "signing-failed",
        reason: `Your signer refused this pointer.${detail}`,
      });
    }
  }

  return { signed, failures };
}

export async function publishPointersToRelay(input: {
  target: PointerPublishTarget;
  pointers: SignedPointer[];
  signer: NostrSigner;
  signal: AbortSignal;
}): Promise<PointerRelayResult[]> {
  let session;
  try {
    session = openDestinationRelay({
      destination: input.target.relay,
      signer: input.signer,
      signal: input.signal,
    });
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
    return input.pointers.map((pointer) => ({
      kind: pointer.kind,
      label: pointer.label,
      relay: input.target.relay,
      isDiscoveryRelay: input.target.isDiscoveryRelay,
      status: "publish-failed",
      reason: `The relay connection could not start.${detail}`,
    }));
  }

  try {
    const results: PointerRelayResult[] = [];
    for (const pointer of input.pointers) {
      const outcome = await session.publish(pointer.event);
      if (outcome.status === "accepted") {
        results.push({ kind: pointer.kind, label: pointer.label, relay: input.target.relay, isDiscoveryRelay: input.target.isDiscoveryRelay, status: "published" });
      } else if (outcome.status === "duplicate") {
        results.push({ kind: pointer.kind, label: pointer.label, relay: input.target.relay, isDiscoveryRelay: input.target.isDiscoveryRelay, status: "duplicate", reason: outcome.message });
      } else {
        results.push({ kind: pointer.kind, label: pointer.label, relay: input.target.relay, isDiscoveryRelay: input.target.isDiscoveryRelay, status: "publish-failed", reason: outcome.message });
      }
    }
    return results;
  } finally {
    await session.close();
  }
}

function isAccepted(result: DiscoveryPointerResult): result is PointerRelayResult {
  return "relay" in result && (result.status === "published" || result.status === "duplicate");
}

export function summarizePointerResults(input: {
  pointers: Array<{ kind: number; label: string }>;
  targets: PointerPublishTarget[];
  results: DiscoveryPointerResult[];
}): DiscoveryPointerSummary[] {
  return input.pointers.map((pointer) => {
    const results = input.results.filter((result) => result.kind === pointer.kind);
    const preparationFailure = results.find((result): result is PointerPreparationFailure => !("relay" in result));
    const accepted = results.filter(isAccepted);
    const acceptedDiscoveryRelays = accepted.filter((result) => result.isDiscoveryRelay).map((result) => result.relay);
    const failures = results
      .filter((result) => result.status === "publish-failed" || result.status === "blocked" || result.status === "signing-failed")
      .map((result) => ({ relay: "relay" in result ? result.relay : undefined, reason: result.reason ?? "The pointer was not published." }));

    let status: DiscoveryPointerSummary["status"];
    if (preparationFailure) status = preparationFailure.status;
    else if (acceptedDiscoveryRelays.length > 0) status = "published";
    else if (accepted.length > 0) status = "destination-only";
    else status = "failed";

    return {
      kind: pointer.kind,
      label: pointer.label,
      status,
      acceptedRelays: accepted.map((result) => result.relay),
      acceptedDiscoveryRelays,
      totalRelays: input.targets.length,
      totalDiscoveryRelays: input.targets.filter((target) => target.isDiscoveryRelay).length,
      failures,
    };
  });
}
