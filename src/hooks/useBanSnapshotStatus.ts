// ABOUTME: Lazily checks the signed-in account's private pre-ban snapshot status
// ABOUTME: Keeps results account-scoped, uncached after unmount, and retries temporary server failures only

import type { NostrSigner } from "@nostrify/nostrify";
import { useQuery } from "@tanstack/react-query";

import { getFunnelcakeBaseUrl } from "@/config/api";
import { BanSnapshotError, fetchSnapshotStatus } from "@/lib/exit/banSnapshotClient";

export function useBanSnapshotStatus(input: { pubkey?: string; signer?: NostrSigner | null }) {
  return useQuery({
    queryKey: ["ban-snapshot-status", input.pubkey],
    queryFn: ({ signal }) => fetchSnapshotStatus({
      endpointBase: getFunnelcakeBaseUrl(),
      pubkey: input.pubkey ?? "",
      signer: input.signer!,
      signal,
    }),
    enabled: false,
    gcTime: 0,
    staleTime: 0,
    retry: (failureCount, error) => error instanceof BanSnapshotError && error.status === 503 && failureCount < 2,
  });
}
