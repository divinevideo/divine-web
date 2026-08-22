import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFixtureFetch } from "@/lib/exit/__fixtures__/fixtureFetch";
import { FixtureSigner } from "@/lib/exit/__fixtures__/fixtureSigner";
import { fixturePubkey } from "@/lib/exit/__fixtures__/exportFixtures";
import { TestApp } from "@/test/TestApp";

import { ExitStartPage } from "./ExitStartPage";

vi.mock("@/components/MarketingLayout", () => ({ MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/auth/LocalNsecBanner", () => ({ LocalNsecBanner: () => null }));
vi.mock("@/lib/localNsecAccount", () => ({ getLocalNsecLogin: () => null }));
vi.mock("@/components/exit/DiscoveryPointerForm", () => ({ DiscoveryPointerForm: () => <div>Discovery pointer form</div> }));

const signer = new FixtureSigner();
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ user: { pubkey: fixturePubkey, signer }, signer, isResolvingJwt: false }),
}));

const mockMirror = vi.fn();
const mockRepublish = vi.fn();
vi.mock("@/hooks/useDestinationMirror", () => ({ useDestinationMirror: () => mockMirror() }));
vi.mock("@/hooks/useDestinationRepublish", () => ({ useDestinationRepublish: () => mockRepublish() }));

describe("ExitStartPage discovery pointer gate", () => {
  beforeEach(() => {
    mockMirror.mockReturnValue({ state: "complete", progress: null, results: [], summary: {}, failure: null, destination: "https://blossom.example", start: vi.fn() });
    mockRepublish.mockReturnValue({ state: "complete", progress: null, results: [], summary: { published: 0, unchanged: 1, failed: 0, skipped: 0, remainingMediaUrls: 0 }, failure: null, destination: "wss://relay.example/", start: vi.fn() });
    vi.stubGlobal("fetch", createFixtureFetch("one-page"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function createArchive() {
    render(<TestApp><ExitStartPage /></TestApp>);
    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));
    await waitFor(() => expect(screen.getByText("Discovery pointer form")).toBeInTheDocument());
  }

  it("offers pointers after at least one destination event succeeds", async () => {
    await createArchive();
    expect(screen.getByRole("heading", { name: "Publish your new home" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Old copies stay where they are" })).toBeInTheDocument();
    expect(
      screen.getByText(/Those copies can still point at Divine-hosted media/)
    ).toBeInTheDocument();
  });

  it("does not offer pointers after an all-failed republish", async () => {
    mockRepublish.mockReturnValue({ state: "complete", progress: null, results: [], summary: { published: 0, unchanged: 0, failed: 2, skipped: 0, remainingMediaUrls: 0 }, failure: null, destination: "wss://relay.example/", start: vi.fn() });
    render(<TestApp><ExitStartPage /></TestApp>);
    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));
    await waitFor(() => expect(screen.getByText(/Your archive is ready/)).toBeInTheDocument());
    expect(screen.queryByText("Discovery pointer form")).not.toBeInTheDocument();
  });
});
