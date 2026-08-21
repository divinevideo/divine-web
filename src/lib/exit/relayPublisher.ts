// ABOUTME: Re-signs changed archive events and publishes them to one destination relay
// ABOUTME: Orders referenced events first while isolating signer and relay failures per event

import { NRelay1, type NostrEvent, type NostrSigner } from "@nostrify/nostrify";

import {
  buildDestinationUrlMap,
  referencedEventIds,
  republishSkipReason,
  rewriteEventMedia,
  rewriteEventReferences,
} from "./eventRewrite";
import { DestinationError } from "./destination";
import type { MirrorResult } from "./mirrorClient";
import { normalizeRelayDestinationUrl } from "./relayDestination";

export type PublishStatus = "published" | "unchanged" | "skipped" | "failed";

export interface PublishResult {
  event_id: string;
  published_event_id: string | null;
  kind: number;
  status: PublishStatus;
  remaining_media_urls: number;
  reason?: string;
}

export interface PublishProgress {
  completed: number;
  total: number;
  result: PublishResult;
}

export interface PublishSummary {
  published: number;
  unchanged: number;
  skipped: number;
  failed: number;
  remainingMediaUrls: number;
}

interface RelayConnection {
  event(event: NostrEvent, options?: { signal?: AbortSignal }): Promise<void>;
  close(): Promise<void>;
}

interface RelayFactoryOptions {
  auth(challenge: string): Promise<NostrEvent>;
}

export interface PublishArchiveOptions {
  destination: string;
  events: NostrEvent[];
  mirrorResults: MirrorResult[];
  signer: NostrSigner;
  signal?: AbortSignal;
  relayFactory?: (url: string, options: RelayFactoryOptions) => RelayConnection;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  eventTimeoutMs?: number;
  maxRateLimitRetries?: number;
  onProgress?(progress: PublishProgress): void;
}

interface PreparedEvent {
  original: NostrEvent;
  event: NostrEvent;
  changed: boolean;
  remainingMediaUrls: number;
}

interface RelayAuthState {
  failure: string | null;
  currentPublish: AbortController | null;
  handshake: Promise<void> | null;
}

const HEX_64 = /^[0-9a-f]{64}$/i;
const DEFAULT_EVENT_TIMEOUT_MS = 15_000;

function defaultWait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Republish cancelled", "AbortError"));
      return;
    }
    const timeout = window.setTimeout(resolve, milliseconds);
    const abort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Republish cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function relayRefusal(error: unknown): { code: string; message: string; retry: boolean; duplicate: boolean } {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { code: "timeout", message: "The relay did not answer before the publish timed out.", retry: false, duplicate: false };
  }
  const raw = error instanceof Error ? error.message.trim() : "";
  const separator = raw.indexOf(":");
  const prefix = (separator === -1 ? "" : raw.slice(0, separator)).toLowerCase();
  const detail = (separator === -1 ? raw : raw.slice(separator + 1)).replace(/\s+/g, " ").trim().slice(0, 200);
  switch (prefix) {
    case "duplicate": return { code: prefix, message: "The relay already has this event.", retry: false, duplicate: true };
    case "rate-limited": return { code: prefix, message: "The relay is accepting events too slowly.", retry: true, duplicate: false };
    case "auth-required": return { code: prefix, message: "The relay wanted proof of your account before accepting this event.", retry: true, duplicate: false };
    case "blocked": return { code: prefix, message: `The relay blocked this event.${detail ? ` ${detail}` : ""}`, retry: false, duplicate: false };
    case "restricted": return { code: prefix, message: `The relay restricts this event.${detail ? ` ${detail}` : ""}`, retry: false, duplicate: false };
    case "invalid": return { code: prefix, message: `The relay says this event is invalid.${detail ? ` ${detail}` : ""}`, retry: false, duplicate: false };
    case "pow": return { code: prefix, message: `The relay requires proof of work.${detail ? ` ${detail}` : ""}`, retry: false, duplicate: false };
    default: return { code: "relay-error", message: raw || "The relay returned a response this tool could not read.", retry: false, duplicate: false };
  }
}

function publishSignal(parent: AbortSignal | undefined, timeoutMs: number, authState: RelayAuthState): { signal: AbortSignal; dispose(): void } {
  const timeout = new AbortController();
  const currentPublish = new AbortController();
  authState.currentPublish = currentPublish;
  const handle = window.setTimeout(() => timeout.abort(), timeoutMs);
  const signals = [timeout.signal, currentPublish.signal];
  if (parent) signals.push(parent);
  return {
    signal: AbortSignal.any(signals),
    dispose: () => {
      window.clearTimeout(handle);
      if (authState.currentPublish === currentPublish) authState.currentPublish = null;
    },
  };
}

async function createRelayAuth(signer: NostrSigner, relay: string, challenge: string): Promise<NostrEvent> {
  return signer.signEvent({
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    content: "",
    tags: [["relay", relay], ["challenge", challenge]],
  });
}

async function prepareEvents(options: PublishArchiveOptions): Promise<{
  events: PreparedEvent[];
  results: PublishResult[];
}> {
  const originals = new Map(options.events.map((event) => [event.id, event]));
  const destinationUrls = buildDestinationUrlMap(options.mirrorResults);
  const replacements = new Map<string, NostrEvent>();
  const prepared = new Map<string, PreparedEvent>();
  const settled = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const cyclic = new Set<string>();
  const events: PreparedEvent[] = [];
  const results: PublishResult[] = [];

  async function prepare(original: NostrEvent): Promise<PreparedEvent | null> {
    if (options.signal?.aborted) throw new DOMException("Republish cancelled", "AbortError");
    const existing = prepared.get(original.id);
    if (existing) return existing;
    if (settled.has(original.id)) return null;
    if (visiting.has(original.id)) {
      const cycleStart = stack.indexOf(original.id);
      for (const id of stack.slice(cycleStart)) cyclic.add(id);
      return null;
    }
    const skipReason = republishSkipReason(original.kind);
    if (skipReason) {
      settled.add(original.id);
      results.push({ event_id: original.id, published_event_id: null, kind: original.kind, status: "skipped", remaining_media_urls: 0, reason: skipReason });
      return null;
    }

    visiting.add(original.id);
    stack.push(original.id);
    for (const reference of referencedEventIds(original)) {
      const dependency = originals.get(reference);
      if (dependency) await prepare(dependency);
    }
    visiting.delete(original.id);
    stack.pop();

    if (cyclic.has(original.id)) {
      settled.add(original.id);
      results.push({
        event_id: original.id,
        published_event_id: null,
        kind: original.kind,
        status: "failed",
        remaining_media_urls: 0,
        reason: "This event belongs to a circular reference chain that cannot be safely rewritten.",
      });
      return null;
    }

    const media = rewriteEventMedia(original, destinationUrls);
    const references = rewriteEventReferences(media.template, replacements);
    const changed = media.changed || references.changed;
    let event = original;
    if (changed) {
      try {
        event = await options.signer.signEvent(references.template);
        if (event.pubkey !== original.pubkey || !HEX_64.test(event.id)) {
          throw new Error("The signer returned an event for a different account.");
        }
      } catch (error) {
        settled.add(original.id);
        const reason = error instanceof Error && error.message
          ? `Your signer refused this event. ${error.message}`
          : "Your signer refused this event.";
        results.push({ event_id: original.id, published_event_id: null, kind: original.kind, status: "failed", remaining_media_urls: media.remainingMediaUrls, reason });
        return null;
      }
    }
    const value = { original, event, changed, remainingMediaUrls: media.remainingMediaUrls };
    prepared.set(original.id, value);
    settled.add(original.id);
    if (changed) replacements.set(original.id, event);
    events.push(value);
    return value;
  }

  for (const event of options.events) await prepare(event);
  return { events, results };
}

async function publishOne(
  relay: RelayConnection,
  prepared: PreparedEvent,
  options: PublishArchiveOptions,
  authState: RelayAuthState,
): Promise<PublishResult> {
  const wait = options.wait ?? defaultWait;
  for (let attempt = 0; ; attempt += 1) {
    if (options.signal?.aborted) throw new DOMException("Republish cancelled", "AbortError");
    const timed = publishSignal(options.signal, options.eventTimeoutMs ?? DEFAULT_EVENT_TIMEOUT_MS, authState);
    try {
      await relay.event(prepared.event, { signal: timed.signal });
      return {
        event_id: prepared.original.id,
        published_event_id: prepared.event.id,
        kind: prepared.original.kind,
        status: prepared.changed ? "published" : "unchanged",
        remaining_media_urls: prepared.remainingMediaUrls,
      };
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException("Republish cancelled", "AbortError");
      if (authState.failure) throw new DestinationError("auth-required", authState.failure);
      const refusal = relayRefusal(error);
      if (refusal.duplicate) {
        return {
          event_id: prepared.original.id,
          published_event_id: prepared.event.id,
          kind: prepared.original.kind,
          status: prepared.changed ? "published" : "unchanged",
          remaining_media_urls: prepared.remainingMediaUrls,
          reason: refusal.message,
        };
      }
      if (refusal.retry && attempt < (options.maxRateLimitRetries ?? 2)) {
        // A NIP-42 relay challenges on connect and refuses whatever is already
        // on the wire. Nostrify answers the challenge but never resends those
        // events, so wait for the signature to settle and send them again.
        // Bounded by the per-event timeout so a signer that never answers
        // cannot stall the run.
        if (refusal.code === "auth-required" && authState.handshake) {
          await Promise.race([authState.handshake, wait(options.eventTimeoutMs ?? DEFAULT_EVENT_TIMEOUT_MS, options.signal)]);
        }
        await wait(1000 * 2 ** attempt, options.signal);
        continue;
      }
      return {
        event_id: prepared.original.id,
        published_event_id: null,
        kind: prepared.original.kind,
        status: "failed",
        remaining_media_urls: prepared.remainingMediaUrls,
        reason: refusal.message,
      };
    } finally {
      timed.dispose();
    }
  }
}

export async function publishArchiveEvents(options: PublishArchiveOptions): Promise<PublishResult[]> {
  const destination = normalizeRelayDestinationUrl(options.destination);
  const preparation = await prepareEvents(options);
  const results = [...preparation.results];
  if (preparation.events.length === 0) return results;
  const relayFactory = options.relayFactory ?? ((url, relayOptions) => new NRelay1(url, {
    auth: relayOptions.auth,
    backoff: false,
    idleTimeout: false,
  }));
  const authState: RelayAuthState = { failure: null, currentPublish: null, handshake: null };
  const relay = relayFactory(destination, {
    auth: async (challenge) => {
      const handshake = createRelayAuth(options.signer, destination, challenge);
      authState.handshake = handshake.then(() => undefined, () => undefined);
      try {
        return await handshake;
      } catch {
        authState.failure = "Your signer refused the relay's access request.";
        authState.currentPublish?.abort();
        throw new DestinationError("auth-required", authState.failure);
      }
    },
  });
  try {
    for (const event of preparation.events) {
      const result = await publishOne(relay, event, options, authState);
      results.push(result);
      options.onProgress?.({ completed: results.length, total: options.events.length, result });
    }
  } finally {
    await relay.close();
  }
  return results;
}

export function summarizePublishResults(results: PublishResult[]): PublishSummary {
  return {
    published: results.filter((result) => result.status === "published").length,
    unchanged: results.filter((result) => result.status === "unchanged").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    remainingMediaUrls: results.reduce((total, result) => total + result.remaining_media_urls, 0),
  };
}
