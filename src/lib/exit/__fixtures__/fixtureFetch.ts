// ABOUTME: Scripted fetch responses covering owner-export success and failure paths
// ABOUTME: Test-only support code, never imported by production paths

import { emptyExport, multiPageExport, onePageExport, type FixtureScenario } from "./exportFixtures";

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers
    }
  });
}

export function createFixtureFetch(scenario: FixtureScenario): typeof fetch {
  let requestCount = 0;

  return async (input) => {
    requestCount += 1;
    const url = new URL(input instanceof Request ? input.url : input.toString());

    if (scenario === "auth-failure") {
      return jsonResponse({ error: "missing or invalid auth" }, 401);
    }

    if (scenario === "pubkey-mismatch") {
      return jsonResponse({ error: "pubkey mismatch" }, 403);
    }

    if (scenario === "network-failure") {
      throw new TypeError("failed to fetch");
    }

    if (scenario === "server-failure") {
      return jsonResponse({ error: "server failure" }, 503);
    }

    if (scenario === "bad-cursor") {
      return jsonResponse({ error: "malformed cursor" }, 400);
    }

    if (scenario === "expired-cursor") {
      return jsonResponse({ error: "expired cursor token" }, 400);
    }

    if (scenario === "rate-limit" && requestCount === 1) {
      return jsonResponse({ error: "slow down" }, 429, { "retry-after": "0" });
    }

    if (scenario === "always-rate-limit") {
      return jsonResponse({ error: "slow down" }, 429, { "retry-after": "0" });
    }

    if (scenario === "empty") {
      return jsonResponse(emptyExport);
    }

    if (scenario === "multi-page") {
      return jsonResponse(url.searchParams.has("cursor") ? multiPageExport[1] : multiPageExport[0]);
    }

    return jsonResponse(onePageExport);
  };
}
