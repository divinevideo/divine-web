// ABOUTME: Validates user-provided relay destinations for account republication
// ABOUTME: Preserves legitimate relay paths while rejecting unsafe remote endpoints

import { isRemoteSuppliedRelayUrlAllowed } from "@/lib/relayUrlPolicy";

import { DestinationError } from "./destination";

export function normalizeRelayDestinationUrl(value: string): string {
  let destination: URL;
  try {
    destination = new URL(value.trim());
  } catch {
    throw new DestinationError("invalid-relay-url", "Enter a complete relay URL.");
  }

  if (destination.protocol !== "wss:") {
    throw new DestinationError("insecure-relay-scheme", "Use a secure wss:// relay URL.");
  }
  if (destination.username || destination.password) {
    throw new DestinationError("embedded-credentials", "Remove the username and password from this URL.");
  }
  if (destination.hash) {
    throw new DestinationError("fragment-not-allowed", "Remove the fragment from this URL.");
  }
  if (!isRemoteSuppliedRelayUrlAllowed(destination.toString())) {
    throw new DestinationError("private-relay-host", "Use a public relay address, not a private or local host.");
  }

  destination.protocol = "wss:";
  destination.hostname = destination.hostname.toLowerCase();
  return destination.toString();
}
