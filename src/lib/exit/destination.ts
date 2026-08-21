// ABOUTME: Validates and normalizes user-provided Blossom destination URLs
// ABOUTME: Rejects URL features that could hide credentials or change endpoint routing

export type DestinationErrorCode =
  | "invalid-url"
  | "insecure-scheme"
  | "embedded-credentials"
  | "path-not-allowed"
  | "query-not-allowed"
  | "fragment-not-allowed"
  | "unreachable"
  | "auth-required"
  | "no-mirror-support"
  | "rate-limited";

export class DestinationError extends Error {
  constructor(
    public readonly code: DestinationErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DestinationError";
  }
}

export function normalizeDestinationUrl(value: string): string {
  let destination: URL;
  try {
    destination = new URL(value.trim());
  } catch {
    throw new DestinationError("invalid-url", "Enter a complete Blossom server URL.");
  }
  if (destination.protocol !== "https:") {
    throw new DestinationError("insecure-scheme", "Use an HTTPS Blossom server URL.");
  }
  if (destination.username || destination.password) {
    throw new DestinationError("embedded-credentials", "Remove the username and password from this URL.");
  }
  if (destination.search) {
    throw new DestinationError("query-not-allowed", "Remove the query string from this URL.");
  }
  if (destination.hash) {
    throw new DestinationError("fragment-not-allowed", "Remove the fragment from this URL.");
  }
  // BUD-01 requires every Blossom endpoint to live at the domain root, so a
  // path would deterministically address the wrong `/mirror` endpoint.
  if (destination.pathname.replace(/\/+$/, "")) {
    throw new DestinationError(
      "path-not-allowed",
      `Blossom servers answer at the domain root. Use ${destination.origin} instead.`,
    );
  }
  return destination.origin;
}
