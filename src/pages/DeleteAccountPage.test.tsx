import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TestApp } from "@/test/TestApp";

import { DeleteAccountPage } from "./DeleteAccountPage";

describe("DeleteAccountPage", () => {
  it("explains mobile and web account deletion without overpromising network deletion", () => {
    const { container } = render(
      <TestApp>
        <DeleteAccountPage />
      </TestApp>
    );

    expect(
      screen.getByRole("heading", { name: "Delete your Divine account" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Delete Account and Data/)).toBeInTheDocument();
    expect(screen.getByText(/Open a Support request/)).toBeInTheDocument();
    expect(
      screen.getByText(/Divine can delete from Divine-controlled services/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Open networks can have copies/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Divine also cannot control every copy outside Divine/)
    ).toBeInTheDocument();
    expect(container.querySelector('a[href="mailto:support@divine.video"]')).toBeTruthy();
  });
});
