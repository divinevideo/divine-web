import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TestApp } from "@/test/TestApp";

import { AgeReviewPage } from "./AgeReviewPage";

describe("AgeReviewPage", () => {
  it("tells the reader directly what happens to their account", () => {
    render(
      <TestApp>
        <AgeReviewPage />
      </TestApp>
    );

    expect(
      screen.getByText(/we close your account and delete what we hold about you/i)
    ).toBeInTheDocument();
  });
  it("keeps the exact retention carve-out on the page, inside a disclosure", () => {
    render(
      <TestApp>
        <AgeReviewPage />
      </TestApp>
    );

    const clause = screen.getByText(
      /except information Divine is required or permitted to keep for legal, safety, security, fraud-prevention, dispute-resolution, or compliance purposes/
    );

    expect(clause).toBeInTheDocument();
    expect(clause.closest("details")).not.toBeNull();
  });
  it("keeps the exact video retention wording on the page, inside a disclosure", () => {
    render(
      <TestApp>
        <AgeReviewPage />
      </TestApp>
    );

    const clause = screen.getByText(
      /Divine uses the video only for account review, safety, legal, and compliance purposes, and keeps it only as long as reasonably necessary for those purposes unless a longer retention period is required or permitted by law/
    );

    expect(clause).toBeInTheDocument();
    expect(clause.closest("details")).not.toBeNull();
  });
  it("addresses the reader directly in the hero rather than describing an account", () => {
    render(
      <TestApp>
        <AgeReviewPage />
      </TestApp>
    );

    expect(
      screen.getByText(/we think you might be under 16/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Divine flagged this account as possibly belonging to someone under 16/i)
    ).not.toBeInTheDocument();
  });
});
