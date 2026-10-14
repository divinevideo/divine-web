import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";

import { BanSnapshotError, fetchSnapshotStatus } from "@/lib/exit/banSnapshotClient";

import { useBanSnapshotStatus } from "./useBanSnapshotStatus";

vi.mock("@/config/api", () => ({ getFunnelcakeBaseUrl: () => "https://api.divine.video" }));
vi.mock("@/lib/exit/banSnapshotClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exit/banSnapshotClient")>();
  return { ...actual, fetchSnapshotStatus: vi.fn() };
});

const signer = {} as Parameters<typeof useBanSnapshotStatus>[0]["signer"];
const pubkeyA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const pubkeyB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("useBanSnapshotStatus", () => {
  it("aborts and discards an in-flight check when the account changes", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    let firstSignal: AbortSignal | undefined;
    vi.mocked(fetchSnapshotStatus).mockImplementation(({ pubkey, signal }) => {
      if (pubkey === pubkeyA) {
        firstSignal = signal;
        return new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new BanSnapshotError("cancelled", "cancelled")), { once: true }));
      }
      return Promise.resolve({ state: "absent", enforcement_id: null, enforced_at: null, created_at: null, expires_at: null, days_remaining: null });
    });

    const { result, rerender } = renderHook(({ pubkey }) => useBanSnapshotStatus({ pubkey, signer }), { initialProps: { pubkey: pubkeyA }, wrapper });
    act(() => { void result.current.refetch(); });
    await waitFor(() => expect(firstSignal).toBeDefined());
    rerender({ pubkey: pubkeyB });
    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
