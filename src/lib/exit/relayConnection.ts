// ABOUTME: Publishes signed Nostr events through one authenticated destination relay session
// ABOUTME: Centralizes relay refusal, retry, timeout, cancellation, and NIP-42 behavior

import { NRelay1, type NostrEvent, type NostrSigner } from "@nostrify/nostrify";

import { DestinationError } from "./destination";

export type RelayPublishOutcome =
  | { status: "accepted" }
  | { status: "duplicate"; message: string }
  | { status: "failed"; code: string; message: string };

interface RelayConnection {
  event(event: NostrEvent, options?: { signal?: AbortSignal }): Promise<void>;
  close(): Promise<void>;
}

interface RelayFactoryOptions {
  auth(challenge: string): Promise<NostrEvent>;
}

interface RelayAuthState {
  failure: string | null;
  currentPublish: AbortController | null;
  handshake: Promise<void> | null;
}

export interface DestinationRelayOptions {
  destination: string;
  signer: NostrSigner;
  signal?: AbortSignal;
  relayFactory?: (url: string, options: RelayFactoryOptions) => RelayConnection;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  eventTimeoutMs?: number;
  maxRateLimitRetries?: number;
}

export interface DestinationRelaySession {
  publish(event: NostrEvent): Promise<RelayPublishOutcome>;
  close(): Promise<void>;
}

const DEFAULT_EVENT_TIMEOUT_MS = 15_000;

function defaultWait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Relay publish cancelled", "AbortError"));
      return;
    }
    const timeout = window.setTimeout(resolve, milliseconds);
    const abort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Relay publish cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

type RelayRefusal = Exclude<RelayPublishOutcome, { status: "accepted" }> & { retry?: boolean };

function relayRefusal(error: unknown): RelayRefusal {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { status: "failed", code: "timeout", message: "The relay did not answer before the publish timed out." };
  }
  const raw = error instanceof Error ? error.message.trim() : "";
  const separator = raw.indexOf(":");
  const prefix = (separator === -1 ? "" : raw.slice(0, separator)).toLowerCase();
  const detail = (separator === -1 ? raw : raw.slice(separator + 1)).replace(/\s+/g, " ").trim().slice(0, 200);
  switch (prefix) {
    case "duplicate": return { status: "duplicate", message: "The relay already has this event." };
    case "rate-limited": return { status: "failed", code: prefix, message: "The relay is accepting events too slowly.", retry: true };
    case "auth-required": return { status: "failed", code: prefix, message: "The relay wanted proof of your account before accepting this event.", retry: true };
    case "blocked": return { status: "failed", code: prefix, message: `The relay blocked this event.${detail ? ` ${detail}` : ""}` };
    case "restricted": return { status: "failed", code: prefix, message: `The relay restricts this event.${detail ? ` ${detail}` : ""}` };
    case "invalid": return {
      status: "failed",
      code: /created_at too (?:early|old)/i.test(detail) ? "created-at-too-old" : prefix,
      message: `The relay says this event is invalid.${detail ? ` ${detail}` : ""}`,
    };
    case "pow": return { status: "failed", code: prefix, message: `The relay requires proof of work.${detail ? ` ${detail}` : ""}` };
    default: return { status: "failed", code: "relay-error", message: raw || "The relay returned a response this tool could not read." };
  }
}

function publishSignal(parent: AbortSignal | undefined, timeoutMs: number, authState: RelayAuthState) {
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

export function openDestinationRelay(options: DestinationRelayOptions): DestinationRelaySession {
  const wait = options.wait ?? defaultWait;
  const timeoutMs = options.eventTimeoutMs ?? DEFAULT_EVENT_TIMEOUT_MS;
  const authState: RelayAuthState = { failure: null, currentPublish: null, handshake: null };
  const relayFactory = options.relayFactory ?? ((url, relayOptions) => new NRelay1(url, {
    auth: relayOptions.auth,
    backoff: false,
    idleTimeout: false,
  }));
  const relay = relayFactory(options.destination, {
    auth: async (challenge) => {
      const handshake = options.signer.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        content: "",
        tags: [["relay", options.destination], ["challenge", challenge]],
      });
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

  return {
    async publish(event) {
      for (let attempt = 0; ; attempt += 1) {
        if (options.signal?.aborted) throw new DOMException("Relay publish cancelled", "AbortError");
        if (authState.failure) return { status: "failed", code: "auth-required", message: authState.failure };
        const timed = publishSignal(options.signal, timeoutMs, authState);
        try {
          await relay.event(event, { signal: timed.signal });
          return { status: "accepted" };
        } catch (error) {
          if (options.signal?.aborted) throw new DOMException("Relay publish cancelled", "AbortError");
          if (authState.failure) return { status: "failed", code: "auth-required", message: authState.failure };
          const refusal = relayRefusal(error);
          if (refusal.status === "duplicate") return refusal;
          if (refusal.retry && attempt < (options.maxRateLimitRetries ?? 2)) {
            // Nostrify answers a connect-time NIP-42 challenge but does not
            // resend events that were already refused while auth was pending.
            if (refusal.code === "auth-required" && authState.handshake) {
              await Promise.race([authState.handshake, wait(timeoutMs, options.signal)]);
            }
            await wait(1000 * 2 ** attempt, options.signal);
            continue;
          }
          return refusal;
        } finally {
          timed.dispose();
        }
      }
    },
    close: () => relay.close(),
  };
}
