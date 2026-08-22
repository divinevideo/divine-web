// ABOUTME: Re-signs changed archive events and publishes them to one destination relay
// ABOUTME: Orders referenced events first while isolating signer and relay failures per event

import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";

import {
  buildDestinationUrlMap,
  referencedEventIds,
  republishCreatedAt,
  republishSkipReason,
  rewriteEventMedia,
  rewriteEventReferences,
} from "./eventRewrite";
import type { MirrorResult } from "./mirrorClient";
import { normalizeRelayDestinationUrl } from "./relayDestination";
import { openDestinationRelay, type DestinationRelayOptions } from "./relayConnection";
import { redateArchivedVideo } from "./videoTimestamp";

export type PublishStatus = "published" | "unchanged" | "skipped" | "failed";

export interface PublishResult {
  event_id: string;
  published_event_id: string | null;
  kind: number;
  status: PublishStatus;
  remaining_media_urls: number;
  redated: boolean;
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
  redated: number;
}

export interface PublishArchiveOptions {
  destination: string;
  events: NostrEvent[];
  mirrorResults: MirrorResult[];
  signer: NostrSigner;
  signal?: AbortSignal;
  relayFactory?: DestinationRelayOptions["relayFactory"];
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  eventTimeoutMs?: number;
  maxRateLimitRetries?: number;
  relayAgeLimitSeconds?: number | null;
  nowSeconds?: number;
  onProgress?(progress: PublishProgress): void;
}

interface PreparedEvent {
  original: NostrEvent;
  event: NostrEvent;
  changed: boolean;
  redated: boolean;
  remainingMediaUrls: number;
}

const HEX_64 = /^[0-9a-f]{64}$/i;
const DEFAULT_RELAY_AGE_LIMIT_SECONDS = 94_608_000;

async function prepareEvents(options: PublishArchiveOptions, now: number, cutoff: number): Promise<{
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
      results.push({ event_id: original.id, published_event_id: null, kind: original.kind, status: "skipped", remaining_media_urls: 0, redated: false, reason: skipReason });
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
        redated: false,
        reason: "This event belongs to a circular reference chain that cannot be safely rewritten.",
      });
      return null;
    }

    const media = rewriteEventMedia(original, destinationUrls);
    const timestamp = redateArchivedVideo(original, media.template, now, cutoff);
    const references = rewriteEventReferences(timestamp.template, replacements);
    const changed = media.changed || references.changed || timestamp.redated;
    let event = original;
    if (changed) {
      try {
        // A deterministic one-second advance prevents replaceable copies from
        // falling back to event-id or arrival-order tie-breaks.
        const template = {
          ...references.template,
          created_at: timestamp.redated ? references.template.created_at : republishCreatedAt(original),
        };
        event = await options.signer.signEvent(template);
        if (event.pubkey !== original.pubkey || !HEX_64.test(event.id)) {
          throw new Error("The signer returned an event for a different account.");
        }
        if (event.created_at !== template.created_at) {
          throw new Error("The signer changed this event's timestamp.");
        }
      } catch (error) {
        settled.add(original.id);
        const reason = error instanceof Error && error.message
          ? `Your signer refused this event. ${error.message}`
          : "Your signer refused this event.";
        results.push({ event_id: original.id, published_event_id: null, kind: original.kind, status: "failed", remaining_media_urls: media.remainingMediaUrls, redated: timestamp.redated, reason });
        return null;
      }
    }
    const value = { original, event, changed, redated: timestamp.redated, remainingMediaUrls: media.remainingMediaUrls };
    prepared.set(original.id, value);
    settled.add(original.id);
    if (changed) replacements.set(original.id, event);
    events.push(value);
    return value;
  }

  for (const event of options.events) await prepare(event);
  return { events, results };
}

export async function publishArchiveEvents(options: PublishArchiveOptions): Promise<PublishResult[]> {
  const destination = normalizeRelayDestinationUrl(options.destination);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ageLimit = options.relayAgeLimitSeconds && options.relayAgeLimitSeconds > 0
    ? options.relayAgeLimitSeconds
    : DEFAULT_RELAY_AGE_LIMIT_SECONDS;
  const preparation = await prepareEvents(options, now, now - ageLimit);
  const results = [...preparation.results];
  if (preparation.events.length === 0) return results;
  const relay = openDestinationRelay({
    destination,
    signer: options.signer,
    signal: options.signal,
    relayFactory: options.relayFactory,
    wait: options.wait,
    eventTimeoutMs: options.eventTimeoutMs,
    maxRateLimitRetries: options.maxRateLimitRetries,
  });
  try {
    for (const event of preparation.events) {
      const outcome = await relay.publish(event.event);
      const result: PublishResult = {
        event_id: event.original.id,
        published_event_id: outcome.status === "failed" ? null : event.event.id,
        kind: event.original.kind,
        status: outcome.status === "failed" ? "failed" : event.changed ? "published" : "unchanged",
        remaining_media_urls: event.remainingMediaUrls,
        redated: event.redated,
        ...(outcome.status !== "accepted" ? { reason: outcome.message } : {}),
      };
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
    redated: results.filter((result) => result.redated && result.status === "published").length,
    remainingMediaUrls: results.reduce((total, result) => total + result.remaining_media_urls, 0),
  };
}
