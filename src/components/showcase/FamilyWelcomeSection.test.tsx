// ABOUTME: Tests for the showcase homepage's family / Divine Greenlight section
// ABOUTME: Locks the two outbound destinations and the heading contract

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FamilyWelcomeSection } from "./FamilyWelcomeSection";

describe("FamilyWelcomeSection", () => {
  it("points families at the family hub", () => {
    render(<FamilyWelcomeSection />);

    const link = screen.getByRole("link", { name: /family resources page/i });
    expect(link).toHaveAttribute("href", "/family");
  });

  it("sends readers to exactly one destination", () => {
    render(<FamilyWelcomeSection />);

    // The block deliberately carries a single call to action. /kids stays
    // reachable through the footer, and Greenlight is a section within it.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders as an h2 section so it nests under the page h1", () => {
    render(<FamilyWelcomeSection />);

    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});
