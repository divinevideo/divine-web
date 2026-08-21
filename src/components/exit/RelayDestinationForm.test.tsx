import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RelayDestinationForm } from "./RelayDestinationForm";

const EVENT_ID = "a".repeat(64);

describe("RelayDestinationForm", () => {
  it("validates the destination beside the relay field", async () => {
    const onStart = vi.fn();
    render(<RelayDestinationForm state="idle" progress={null} results={null} summary={null} failure={null} onStart={onStart} />);
    await userEvent.type(screen.getByLabelText("Relay URL"), "ws://relay.example");
    await userEvent.click(screen.getByRole("button", { name: "Publish my posts" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use a secure wss:// relay URL.");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("shows an honest summary and the full event identifier", async () => {
    render(
      <RelayDestinationForm
        state="complete"
        progress={null}
        results={[{ event_id: EVENT_ID, published_event_id: EVENT_ID, kind: 1, status: "unchanged", remaining_media_urls: 1 }]}
        summary={{ published: 0, unchanged: 1, failed: 0, skipped: 0, remainingMediaUrls: 1 }}
        failure={null}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("0 rewritten, 1 unchanged, 0 failed, and 0 skipped");
    expect(screen.getByRole("status")).toHaveTextContent("1 media link still points to the original location");
    await userEvent.click(screen.getByText("Event results"));
    expect(screen.getByText(EVENT_ID)).toBeInTheDocument();
  });
});
