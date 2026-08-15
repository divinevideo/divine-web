import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { MarketingHeader } from "./MarketingHeader";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "menu.merch" ? "Merch" : key),
  }),
}));

describe("MarketingHeader", () => {
  it("keeps the try-it CTA compact on mobile while preserving desktop nav", () => {
    render(
      <MemoryRouter>
        <MarketingHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Try it" })).toHaveClass(
      "shrink-0",
      "whitespace-nowrap",
      "px-3",
      "sm:px-4",
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveClass("hidden", "md:inline");
    expect(screen.getByRole("link", { name: "Merch" })).toHaveClass("hidden", "md:inline");
    expect(screen.getByRole("link", { name: "Try it" }).querySelector("svg")).toHaveClass(
      "hidden",
      "sm:block",
    );
  });
});
