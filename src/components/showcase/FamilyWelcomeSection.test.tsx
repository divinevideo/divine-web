// ABOUTME: Tests for the showcase homepage's family / Divine Greenlight section
// ABOUTME: Locks the two outbound destinations and the heading contract

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FamilyWelcomeSection } from "./FamilyWelcomeSection";

describe("FamilyWelcomeSection", () => {
  it("points families at the family hub", () => {
    render(<FamilyWelcomeSection />);

    const link = screen.getByRole("link", { name: /family guides/i });
    expect(link).toHaveAttribute("href", "/family");
  });

  it("points teens at the Divine Greenlight section of the kids policy", () => {
    render(<FamilyWelcomeSection />);

    const link = screen.getByRole("link", { name: /divine greenlight/i });
    // The 13-15 anchor is the Greenlight section on /kids; a bare /kids link
    // would drop the reader at the top of a long policy page.
    expect(link).toHaveAttribute("href", "/kids#13-15");
  });

  it("renders as an h2 section so it nests under the page h1", () => {
    render(<FamilyWelcomeSection />);

    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});
