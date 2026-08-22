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
  beforeEach(() => {
    vi.mocked(openDestinationRelay).mockReset().mockImplementation(() => ({
      publish: vi.fn().mockResolvedValue({ status: "accepted" }),
      close: vi.fn().mockResolvedValue(undefined),
    }));
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

    expect(await screen.findByText("Relay list — published to 4 of 4 places apps look.")).toBeInTheDocument();
    expect(screen.getByText("Blossom server list — published to 4 of 4 places apps look.")).toBeInTheDocument();
    expect(screen.getByText("Other apps can now find your new home through public discovery relays.")).toBeInTheDocument();
  });

  it("names a failed relay while accepting partial discovery", async () => {
    vi.mocked(openDestinationRelay).mockImplementation(({ destination }) => ({
      publish: vi.fn().mockResolvedValue(destination === "wss://relay.damus.io/"
        ? { status: "failed", code: "blocked", message: "The relay blocked this event." }
        : { status: "accepted" }),
      close: vi.fn().mockResolvedValue(undefined),
    }));
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Publish destination pointers" }));

    expect(await screen.findByText("Relay list — published to 3 of 4 places apps look.")).toBeInTheDocument();
    expect(screen.getAllByText(/wss:\/\/relay\.damus\.io\/: The relay blocked this event\./)).toHaveLength(2);
    expect(screen.getByText("Other apps can now find your new home through public discovery relays.")).toBeInTheDocument();
  });

  it("does not claim discovery when only the destination accepts pointers", async () => {
    vi.mocked(openDestinationRelay).mockImplementation(({ destination }) => ({
      publish: vi.fn().mockResolvedValue(destination === "wss://relay.example/"
        ? { status: "accepted" }
        : { status: "failed", code: "blocked", message: "The relay blocked this event." }),
      close: vi.fn().mockResolvedValue(undefined),
    }));
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Publish destination pointers" }));

    expect(await screen.findByText("Relay list — only published to your destination.")).toBeInTheDocument();
    expect(screen.getByText("Blossom server list — only published to your destination.")).toBeInTheDocument();
    expect(screen.getByText(/At least one pointer is not discoverable yet/)).toBeInTheDocument();
  });
});
