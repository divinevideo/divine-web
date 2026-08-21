// ABOUTME: Publishes relay and Blossom discovery pointers independently after an account move
// ABOUTME: Reports timestamp, signing, ownership, and relay failures separately for each pointer

import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";
import { useEffect, useRef, useState } from "react";

import type { ArchiveFiles } from "@/lib/exit/archive";
import {
  BLOSSOM_SERVER_LIST_KIND,
  buildBlossomServerListTemplate,
  buildRelayListTemplate,
  MAX_REPLACEMENT_FUTURE_SKEW_SECONDS,
  newestPointerCreatedAt,
  RELAY_LIST_KIND,
  replacementCreatedAt,
} from "@/lib/exit/discoveryPointers";
import { openDestinationRelay } from "@/lib/exit/relayConnection";

export type DiscoveryPointerStatus = "published" | "duplicate" | "blocked" | "signing-failed" | "publish-failed";

export interface DiscoveryPointerResult {
  kind: number;
  label: string;
  status: DiscoveryPointerStatus;
  reason?: string;
}

export function useDiscoveryPointers(input: {
  files: ArchiveFiles;
  relayDestination: string;
  blossomDestination: string;
  signer: NostrSigner;
}) {
  const [state, setState] = useState<"idle" | "running" | "complete">("idle");
  const [results, setResults] = useState<DiscoveryPointerResult[]>([]);
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => () => activeController.current?.abort(), []);

  async function start() {
    const controller = new AbortController();
    activeController.current?.abort();
    activeController.current = controller;
    setState("running");
    setResults([]);
    const ownerPubkey = input.files["manifest.json"].pubkey;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const definitions = [
      { kind: RELAY_LIST_KIND, label: "Relay list", build: buildRelayListTemplate, destination: input.relayDestination },
      { kind: BLOSSOM_SERVER_LIST_KIND, label: "Blossom server list", build: buildBlossomServerListTemplate, destination: input.blossomDestination },
    ];
    const prepared = definitions.map((definition) => {
      const timestamp = replacementCreatedAt({
        nowSeconds,
        newestSeconds: newestPointerCreatedAt(input.files["events.json"], definition.kind, ownerPubkey),
        toleranceSeconds: MAX_REPLACEMENT_FUTURE_SKEW_SECONDS,
      });
      if (timestamp.blocked) {
        return { definition, blocked: { kind: definition.kind, label: definition.label, status: "blocked" as const, reason: timestamp.reason } };
      }
      return { definition, createdAt: timestamp.createdAt };
    });
    if (prepared.every((item) => item.blocked)) {
      setResults(prepared.flatMap((item) => item.blocked ? [item.blocked] : []));
      setState("complete");
      return;
    }
    const nextResults: DiscoveryPointerResult[] = [];
    let session;
    try {
      session = openDestinationRelay({ destination: input.relayDestination, signer: input.signer, signal: controller.signal });
    } catch (error) {
      const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
      setResults(prepared.map((item) => item.blocked ?? {
        kind: item.definition.kind,
        label: item.definition.label,
        status: "publish-failed",
        reason: `The destination relay connection could not start.${detail}`,
      }));
      setState("complete");
      return;
    }
    try {
      for (const item of prepared) {
        if (item.blocked) {
          nextResults.push(item.blocked);
          continue;
        }
        const { definition } = item;
        let event: NostrEvent;
        try {
          event = await input.signer.signEvent(definition.build(definition.destination, item.createdAt));
          if (event.pubkey !== ownerPubkey) throw new Error("The signer returned an event for a different account.");
        } catch (error) {
          const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
          nextResults.push({ kind: definition.kind, label: definition.label, status: "signing-failed", reason: `Your signer refused this pointer.${detail}` });
          continue;
        }
        const outcome = await session.publish(event);
        if (outcome.status === "accepted") {
          nextResults.push({ kind: definition.kind, label: definition.label, status: "published" });
        } else if (outcome.status === "duplicate") {
          nextResults.push({ kind: definition.kind, label: definition.label, status: "duplicate", reason: outcome.message });
        } else {
          nextResults.push({ kind: definition.kind, label: definition.label, status: "publish-failed", reason: outcome.message });
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      await session.close();
    }
    if (!controller.signal.aborted) {
      setResults(nextResults);
      setState("complete");
    }
  }

  return { state, results, start };
}
