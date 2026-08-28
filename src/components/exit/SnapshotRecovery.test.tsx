import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SnapshotRecovery } from "./SnapshotRecovery";

const base = { checkError: null, checking: false, recovering: false, disabled: false, onCheck: vi.fn(), onRecover: vi.fn() };

describe("SnapshotRecovery", () => {
  it("presents an absent result without implying the account was banned", () => {
    render(<SnapshotRecovery {...base} status={{ state: "absent", enforcement_id: null, enforced_at: null, created_at: null, expires_at: null, days_remaining: null }} />);
    expect(screen.getByText("No pre-ban snapshot is available for this account. You can still create the ordinary account archive above.")).toBeInTheDocument();
  });

  it.each([
    ["capture_failed", "Divine could not preserve a complete pre-ban snapshot"],
    ["expired", "The preserved snapshot has expired"],
    ["temporarily_unavailable", "The preserved snapshot exists, but it is temporarily unavailable"],
  ] as const)("presents the %s state distinctly", (state, message) => {
    render(<SnapshotRecovery {...base} status={{ state, enforcement_id: null, enforced_at: null, created_at: null, expires_at: null, days_remaining: null }} />);
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
  });

  it("renders the exact expiry date and starts available recovery", () => {
    const onRecover = vi.fn();
    render(<SnapshotRecovery {...base} onRecover={onRecover} status={{ state: "available", enforcement_id: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", enforced_at: "2026-08-01T12:00:00Z", created_at: "2026-08-01T12:01:00Z", expires_at: "2026-08-31T12:01:00Z", days_remaining: 3 }} />);
    expect(screen.getByText(/Preserved on August 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/August 31, 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recover snapshot" }));
    expect(onRecover).toHaveBeenCalledOnce();
  });
});
