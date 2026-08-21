import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildArchiveFiles } from "@/lib/exit/archive";
import { fixturePubkey, makeFixtureEvent } from "@/lib/exit/__fixtures__/exportFixtures";
import { openDestinationRelay } from "@/lib/exit/relayConnection";

import { DiscoveryPointerForm } from "./DiscoveryPointerForm";

vi.mock("@/lib/exit/relayConnection", () => ({ openDestinationRelay: vi.fn() }));

const files = buildArchiveFiles({
  events: [makeFixtureEvent()],
  pubkey: fixturePubkey,
  sourceEndpoint: "https://api.divine.video",
  pageCount: 1,
  failures: [],
});

const signer = {
  signEvent: vi.fn(async (template: Omit<NostrEvent, "id" | "pubkey" | "sig">) => ({
    ...template,
    id: "a".repeat(64),
    pubkey: fixturePubkey,
    sig: "b".repeat(128),
  })),
} as unknown as NostrSigner;

describe("DiscoveryPointerForm", () => {
  const publish = vi.fn();

  beforeEach(() => {
    publish.mockReset().mockResolvedValue({ status: "accepted" });
    vi.mocked(openDestinationRelay).mockReturnValue({ publish, close: vi.fn().mockResolvedValue(undefined) });
  });

  function renderForm() {
    render(
      <DiscoveryPointerForm
        files={files}
        relayDestination="wss://relay.example/"
        blossomDestination="https://blossom.example"
        signer={signer}
      />,
    );
  }

  it("reports each pointer and confirms automatic discovery after both succeed", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Publish destination pointers" }));

    expect(await screen.findByText("Relay list: published")).toBeInTheDocument();
    expect(screen.getByText("Blossom server list: published")).toBeInTheDocument();
    expect(screen.getByText("Compatible third-party clients that check your destination relay should now find your new home automatically.")).toBeInTheDocument();
  });

  it("keeps a failed pointer separate from a successful one", async () => {
    publish
      .mockResolvedValueOnce({ status: "failed", code: "blocked", message: "The relay blocked this event." })
      .mockResolvedValueOnce({ status: "accepted" });
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Publish destination pointers" }));

    expect(await screen.findByText("Relay list: not published")).toBeInTheDocument();
    expect(screen.getByText("Blossom server list: published")).toBeInTheDocument();
    expect(screen.getByText(/Fix the failed pointer before relying on automatic discovery/)).toBeInTheDocument();
  });
});
