import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DestinationForm } from "./DestinationForm";

describe("DestinationForm", () => {
  it("explains the bounded browser upload path for hashless profile images", () => {
    render(
      <DestinationForm
        state="idle"
        progress={null}
        summary={null}
        failure={null}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText(/your browser verifies and uploads the image directly/i)).toBeInTheDocument();
  });

  it("describes already-present progress and hides zero summary categories", () => {
    render(
      <DestinationForm
        state="complete"
        progress={{
          completed: 1,
          total: 1,
          result: {
            references: [],
            source_url: "https://blossom.example/file.jpg",
            destination_url: "https://blossom.example/file.jpg",
            expected_sha256: "a".repeat(64),
            destination_sha256: "a".repeat(64),
            byte_size: null,
            verification: "already-present",
          },
        }}
        summary={{ mirrored: 0, alreadyPresent: 1, failed: 0, skipped: 0, unverified: 0 }}
        failure={null}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText(/Already at the destination:/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 already there.");
    expect(screen.getByRole("status")).not.toHaveTextContent("0 failed");
  });

  it("has an explicit empty summary", () => {
    render(
      <DestinationForm
        state="complete"
        progress={null}
        summary={{ mirrored: 0, alreadyPresent: 0, failed: 0, skipped: 0, unverified: 0 }}
        failure={null}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No media needed copying.");
  });
});
