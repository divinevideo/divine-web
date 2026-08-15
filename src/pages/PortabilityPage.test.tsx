import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TestApp } from "@/test/TestApp";

import { PortabilityPage } from "./PortabilityPage";

vi.mock("@/components/MarketingLayout", () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("PortabilityPage", () => {
  it("explains account portability without treating moving as deletion", () => {
    const { container } = render(
      <TestApp>
        <PortabilityPage />
      </TestApp>
    );

    expect(
      screen.getByRole("heading", { name: "Move your Divine account" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/It does not delete anything from Divine./)
    ).toBeInTheDocument();
    expect(container.querySelector('a[href="/delete-account"]')).toBeTruthy();
    expect(
      screen.getByText(/Other servers have their own rules./)
    ).toBeInTheDocument();
    expect(container.querySelector('a[href="/safety#appeals"]')).toBeTruthy();
    expect(container.querySelector('a[href="/kids"]')).toBeTruthy();
  });
});
