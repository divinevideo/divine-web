import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TestApp } from "@/test/TestApp";

import { KidsPolicyPage } from "./KidsPolicyPage";

describe("KidsPolicyPage", () => {
  it("keeps the exact under-13 deletion carve-out on the page, inside a disclosure", () => {
    render(
      <TestApp>
        <KidsPolicyPage />
      </TestApp>
    );

    const clause = screen.getByText(
      /except information Divine is required or permitted to keep for legal, safety, security, fraud-prevention, dispute-resolution, or compliance purposes/
    );

    expect(clause).toBeInTheDocument();
    expect(clause.closest("details")).not.toBeNull();
  });

  it("keeps the exact video handling wording on the page, inside a disclosure", () => {
    render(
      <TestApp>
        <KidsPolicyPage />
      </TestApp>
    );

    const clause = screen.getByText(
      /used only for account review, safety, legal, and compliance purposes, kept only as long as reasonably necessary for those purposes unless a longer retention period is required or permitted by law/
    );

    expect(clause).toBeInTheDocument();
    expect(clause.closest("details")).not.toBeNull();
  });
});
