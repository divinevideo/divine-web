// ABOUTME: Publishes account-move pointers to relays where other apps discover them
// ABOUTME: Reports pointer preparation and per-relay publication outcomes independently

import type { NostrSigner } from "@nostrify/nostrify";
import { useEffect, useRef, useState } from "react";

import type { ArchiveFiles } from "@/lib/exit/archive";
import {
  type DiscoveryPointerResult,
  type DiscoveryPointerSummary,
  type PointerToSign,
  prepareSignedPointers,
  publishPointersToRelay,
  summarizePointerResults,
} from "@/lib/exit/discoveryPointerPublisher";
import {
  BLOSSOM_SERVER_LIST_KIND,
  buildBlossomServerListTemplate,
  buildRelayListTemplate,
  MAX_REPLACEMENT_FUTURE_SKEW_SECONDS,
  newestPointerCreatedAt,
  pointerPublishTargets,
  RELAY_LIST_KIND,
  replacementCreatedAt,
} from "@/lib/exit/discoveryPointers";

interface PointerDefinition {
  kind: number;
  label: string;
  build(destination: string, createdAt: number): ReturnType<typeof buildRelayListTemplate>;
  destination: string;
}

function pointerDefinitions(input: { relayDestination: string; blossomDestination: string }): PointerDefinition[] {
  return [
    { kind: RELAY_LIST_KIND, label: "Relay list", build: buildRelayListTemplate, destination: input.relayDestination },
    { kind: BLOSSOM_SERVER_LIST_KIND, label: "Blossom server list", build: buildBlossomServerListTemplate, destination: input.blossomDestination },
  ];
}

function prepareTemplates(input: { files: ArchiveFiles; definitions: PointerDefinition[]; ownerPubkey: string; nowSeconds: number }) {
  const pointers: PointerToSign[] = [];
  const failures: DiscoveryPointerResult[] = [];
  for (const definition of input.definitions) {
    const timestamp = replacementCreatedAt({
      nowSeconds: input.nowSeconds,
      newestSeconds: newestPointerCreatedAt(input.files["events.json"], definition.kind, input.ownerPubkey),
      toleranceSeconds: MAX_REPLACEMENT_FUTURE_SKEW_SECONDS,
    });
    if (timestamp.blocked) failures.push({ kind: definition.kind, label: definition.label, status: "blocked", reason: timestamp.reason });
    else pointers.push({ kind: definition.kind, label: definition.label, template: definition.build(definition.destination, timestamp.createdAt) });
  }
  return { pointers, failures };
}

export function useDiscoveryPointers(input: {
  files: ArchiveFiles;
  relayDestination: string;
  blossomDestination: string;
  signer: NostrSigner;
}) {
  const [state, setState] = useState<"idle" | "running" | "complete">("idle");
  const [results, setResults] = useState<DiscoveryPointerResult[]>([]);
  const [summaries, setSummaries] = useState<DiscoveryPointerSummary[]>([]);
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => () => activeController.current?.abort(), []);

  async function start() {
    const controller = new AbortController();
    activeController.current?.abort();
    activeController.current = controller;
    setState("running");
    setResults([]);
    setSummaries([]);

    const ownerPubkey = input.files["manifest.json"].pubkey;
    const definitions = pointerDefinitions(input);
    const targets = pointerPublishTargets({ relayDestination: input.relayDestination });
    const prepared = prepareTemplates({ files: input.files, definitions, ownerPubkey, nowSeconds: Math.floor(Date.now() / 1000) });
    const signed = await prepareSignedPointers({ pointers: prepared.pointers, signer: input.signer, ownerPubkey });
    if (signed.signed.length === 0) {
      const nextResults = [...prepared.failures, ...signed.failures];
      setResults(nextResults);
      setSummaries(summarizePointerResults({ pointers: definitions, targets, results: nextResults }));
      setState("complete");
      return;
    }
    const settled = await Promise.allSettled(targets.map((target) => publishPointersToRelay({ target, pointers: signed.signed, signer: input.signer, signal: controller.signal })));
    if (controller.signal.aborted) return;
    // publishPointersToRelay reports its own failures and only rejects when the
    // run was cancelled, which the check above already handled.
    const relayResults = settled.flatMap((outcome) => outcome.status === "fulfilled" ? outcome.value : []);
    const nextResults = [...prepared.failures, ...signed.failures, ...relayResults]
      .sort((left, right) => left.kind - right.kind || (("relay" in left ? left.relay : "").localeCompare("relay" in right ? right.relay : "")));
    setResults(nextResults);
    setSummaries(summarizePointerResults({ pointers: definitions, targets, results: nextResults }));
    setState("complete");
  }

  return { state, results, summaries, start };
}
