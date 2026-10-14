// ABOUTME: Fetches media bytes with bounded reads and computes their SHA-256
// ABOUTME: Keeps viewer authorization scoped to the exact Divine media origin

import type { NostrSigner } from "@nostrify/nostrify";

import { createMediaViewerAuthHeader } from "@/lib/mediaViewerAuth";

interface FetchAndHashBlobOptions {
  url: string;
  expectedSha256?: string | null;
  signer?: NostrSigner | null;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  maxBytes?: number;
}

export interface HashedBlob {
  bytes: Uint8Array<ArrayBuffer>;
  computedSha256: string;
  contentType: string | null;
  finalUrl: string;
}

export function isDivineMediaOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "media.divine.video";
  } catch {
    return false;
  }
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertWithinLimit(byteSize: number, maxBytes?: number): void {
  if (maxBytes !== undefined && byteSize > maxBytes) {
    throw new Error(`The source is larger than ${maxBytes} bytes.`);
  }
}

async function readBytes(response: Response, maxBytes?: number): Promise<Uint8Array<ArrayBuffer>> {
  const advertisedSize = response.headers.get("content-length");
  if (advertisedSize !== null) assertWithinLimit(Number(advertisedSize), maxBytes);
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    assertWithinLimit(bytes.length, maxBytes);
    if (advertisedSize !== null && Number(advertisedSize) !== bytes.length) {
      throw new Error("Response byte count did not match Content-Length");
    }
    return bytes;
  }

  const chunks: Uint8Array[] = [];
  let byteSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteSize += value.length;
    if (maxBytes !== undefined && byteSize > maxBytes) {
      await reader.cancel();
      assertWithinLimit(byteSize, maxBytes);
    }
    chunks.push(value);
  }
  if (advertisedSize !== null && Number(advertisedSize) !== byteSize) {
    throw new Error("Response byte count did not match Content-Length");
  }
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(byteSize);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export async function fetchAndHashBlob(options: FetchAndHashBlobOptions): Promise<HashedBlob> {
  const fetcher = options.fetcher ?? fetch;
  const request = async (authorization?: string | null) => fetcher(options.url, {
    method: "GET",
    signal: options.signal,
    redirect: authorization ? "error" : "follow",
    headers: authorization ? { Authorization: authorization } : undefined,
  });
  let response = await request();
  let usedAuthorization = false;
  if ((response.status === 401 || response.status === 403) && isDivineMediaOrigin(options.url)) {
    const authorization = await createMediaViewerAuthHeader({
      signer: options.signer,
      url: options.url,
      sha256: options.expectedSha256 ?? undefined,
    });
    if (authorization) {
      response = await request(authorization);
      usedAuthorization = true;
    }
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const finalUrl = response.url || options.url;
  if (usedAuthorization && !isDivineMediaOrigin(finalUrl)) {
    throw new Error("Divine media redirected to an untrusted origin");
  }
  const bytes = await readBytes(response, options.maxBytes);
  return {
    bytes,
    computedSha256: hex(await crypto.subtle.digest("SHA-256", bytes)),
    contentType: response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? null,
    finalUrl,
  };
}
