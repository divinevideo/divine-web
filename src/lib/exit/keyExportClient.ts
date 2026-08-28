// ABOUTME: Re-authenticates hosted accounts and retrieves their portable Nostr secret key
// ABOUTME: Converts Keycast responses into safe typed failures without exposing response secrets

import { nip19 } from "nostr-tools";

import { DIVINE_LOGIN_ORIGIN } from "@/lib/divineLoginOrigin";

export type KeyExportFailureCode =
  | "policy-denied"
  | "email-unverified"
  | "invalid-password"
  | "auth-required"
  | "rate-limited"
  | "no-hosted-key"
  | "service-unavailable"
  | "malformed-response"
  | "network-failure"
  | "cancelled";

export class KeyExportError extends Error {
  constructor(
    public readonly code: KeyExportFailureCode,
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "KeyExportError";
  }
}

interface KeyExportOptions {
  token: string;
  password: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  now?: () => number;
}

const MAX_RETRY_AFTER_MS = 60_000;

function parseRetryAfter(response: Response, now: () => number): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;

  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(value) - now();

  if (!Number.isFinite(milliseconds) || milliseconds < 0) return undefined;
  return Math.min(milliseconds, MAX_RETRY_AFTER_MS);
}

async function readFailure(response: Response): Promise<{ code?: string; message?: string }> {
  try {
    const text = await response.text();
    try {
      const body = JSON.parse(text) as { code?: unknown; error?: unknown };
      return {
        code: typeof body.code === "string" ? body.code : undefined,
        message: typeof body.error === "string" ? body.error : undefined,
      };
    } catch {
      return { message: text };
    }
  } catch {
    return {};
  }
}

function isAuthFailure(message?: string): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("authentication required")
    || normalized.includes("invalid or expired token")
    || normalized.includes("valid token");
}

function failureFor(
  response: Response,
  body: { code?: string; message?: string },
  now: () => number,
): KeyExportError {
  const retryAfterMs = parseRetryAfter(response, now);

  if (body.code === "KEY_EGRESS_DENIED") {
    return new KeyExportError(
      "policy-denied",
      "Divine cannot export the secret key for this account.",
      response.status,
    );
  }
  if (body.code === "EMAIL_NOT_VERIFIED") {
    return new KeyExportError(
      "email-unverified",
      "Verify the email on this account before exporting its secret key.",
      response.status,
    );
  }
  if (body.code === "TOO_MANY_ATTEMPTS" || response.status === 429) {
    return new KeyExportError(
      "rate-limited",
      "Too many attempts. Wait a bit, then try again.",
      response.status,
      retryAfterMs,
    );
  }
  if (response.status === 401) {
    return isAuthFailure(body.message)
      ? new KeyExportError("auth-required", "Your Divine session expired. Sign in again.", 401)
      : new KeyExportError("invalid-password", "That password did not match this account.", 401);
  }
  if (response.status === 404) {
    return new KeyExportError(
      "no-hosted-key",
      "Divine does not hold a secret key for this account.",
      404,
    );
  }
  if (response.status === 503 || response.status >= 500) {
    return new KeyExportError(
      "service-unavailable",
      "The key service is busy right now. Try again shortly.",
      response.status,
      retryAfterMs,
    );
  }

  return new KeyExportError(
    "malformed-response",
    "Divine returned a response this page could not use.",
    response.status,
  );
}

function validateNsec(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new KeyExportError("malformed-response", "Divine returned a response this page could not use.");
  }

  const key = (body as { key?: unknown }).key;
  if (typeof key !== "string") {
    throw new KeyExportError("malformed-response", "Divine returned a response this page could not use.");
  }

  try {
    const decoded = nip19.decode(key);
    if (decoded.type !== "nsec" || !(decoded.data instanceof Uint8Array) || decoded.data.length !== 32) {
      throw new Error("invalid nsec");
    }
  } catch {
    throw new KeyExportError("malformed-response", "Divine returned a response this page could not use.");
  }

  return key;
}

export async function exportAccountKey(options: KeyExportOptions): Promise<{ nsec: string }> {
  const {
    token,
    password,
    signal,
    fetcher = fetch,
    now = Date.now,
  } = options;

  let response: Response;
  try {
    response = await fetcher(`${DIVINE_LOGIN_ORIGIN}/api/user/export-key`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password, format: "nsec" }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new KeyExportError("cancelled", "The key export was cancelled.");
    }
    throw new KeyExportError("network-failure", "Divine could not be reached. Check your connection and try again.");
  }

  if (!response.ok) {
    throw failureFor(response, await readFailure(response), now);
  }

  try {
    return { nsec: validateNsec(await response.json()) };
  } catch (error) {
    if (error instanceof KeyExportError) throw error;
    throw new KeyExportError("malformed-response", "Divine returned a response this page could not use.");
  }
}
