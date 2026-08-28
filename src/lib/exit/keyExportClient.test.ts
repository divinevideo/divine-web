import { nip19 } from "nostr-tools";
import { describe, expect, it, vi } from "vitest";

import { exportAccountKey, KeyExportError } from "./keyExportClient";

const NSEC = nip19.nsecEncode(new Uint8Array(32).fill(7));

function response(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

async function expectCode(fetcher: typeof fetch, code: KeyExportError["code"]) {
  await expect(exportAccountKey({ token: "token", password: "password", fetcher }))
    .rejects.toMatchObject({ code });
}

describe("exportAccountKey", () => {
  it("posts the password and returns a validated nsec", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(200, { key: NSEC }));

    await expect(exportAccountKey({ token: "token", password: "password", fetcher }))
      .resolves.toEqual({ nsec: NSEC });
    expect(fetcher).toHaveBeenCalledWith(
      "https://login.divine.video/api/user/export-key",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
        body: JSON.stringify({ password: "password", format: "nsec" }),
      }),
    );
  });

  it.each([
    [403, { error: "Operation denied by policy", code: "KEY_EGRESS_DENIED" }, "policy-denied"],
    [403, { error: "Verify your email", code: "EMAIL_NOT_VERIFIED" }, "email-unverified"],
    [401, "Invalid email or password. Please check your credentials and try again.", "invalid-password"],
    [401, "Invalid or expired token. Please log in again.", "auth-required"],
    [404, "No account found with this email. Please register first.", "no-hosted-key"],
    [503, { error: "Password verification timed out. Please retry." }, "service-unavailable"],
  ] as const)("maps status %s to %s", async (status, body, code) => {
    await expectCode(vi.fn<typeof fetch>().mockResolvedValue(response(status, body)), code);
  });

  it("maps rate limits by code and caps Retry-After", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(
      429,
      { error: "Too many attempts", code: "TOO_MANY_ATTEMPTS" },
      { "Retry-After": "3600" },
    ));

    await expect(exportAccountKey({ token: "token", password: "password", fetcher }))
      .rejects.toMatchObject({ code: "rate-limited", retryAfterMs: 60_000 });
  });

  it("parses an HTTP-date Retry-After value", async () => {
    const now = Date.now();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(
      503,
      { error: "Busy" },
      { "Retry-After": new Date(now + 5_000).toUTCString() },
    ));

    try {
      await exportAccountKey({ token: "token", password: "password", fetcher, now: () => now });
    } catch (error) {
      expect(error).toMatchObject({ code: "service-unavailable" });
      expect((error as KeyExportError).retryAfterMs).toBeGreaterThanOrEqual(4_000);
      expect((error as KeyExportError).retryAfterMs).toBeLessThanOrEqual(5_000);
    }
  });

  it.each([
    {},
    { key: "not-an-nsec" },
    { key: nip19.npubEncode("a".repeat(64)) },
  ])("rejects a malformed successful response", async (body) => {
    await expectCode(
      vi.fn<typeof fetch>().mockResolvedValue(response(200, body)),
      "malformed-response",
    );
  });

  it("distinguishes cancellation from network failure", async () => {
    const cancelled = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const failed = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));

    await expectCode(cancelled, "cancelled");
    await expectCode(failed, "network-failure");
  });

  it("never includes a returned key in errors or console output", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(500, { error: NSEC }));

    try {
      await exportAccountKey({ token: "token", password: "password", fetcher });
    } catch (error) {
      expect(String(error)).not.toContain(NSEC);
    }
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });
});
