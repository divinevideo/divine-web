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
    expect(screen.getByText("Account portability")).toBeInTheDocument();
    expect(
      screen.getByText(/It does not delete anything from Divine./)
    ).toBeInTheDocument();
    expect(container.querySelector('a[href="/delete-account"]')).toBeTruthy();
    expect(
      screen.getByText(/If you're looking for information about deleting your Divine account/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Moving is not all-or-nothing./)).toBeInTheDocument();
    expect(
      screen.getByText(/You do not have to choose between Divine and the rest of the network./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Those services can be Divine services, services run by someone else, or a mix of both./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Other servers have their own rules./)
    ).toBeInTheDocument();
    expect(container.querySelector('a[href="/safety#appeals"]')).toBeTruthy();
    expect(screen.getByText(/prevents it from signing an archive request/)).toBeInTheDocument();
    expect(container.querySelector('a[href="/kids"]')).toBeTruthy();
  });

  it("carries the standing key-safety notice", () => {
    render(
      <TestApp>
        <PortabilityPage />
      </TestApp>
    );

    expect(
      screen.getByRole("heading", { name: "Never share your secret key" })
    ).toBeInTheDocument();
  });

  it("sends readers to the working account-moving flow", () => {
    const { container } = render(
      <TestApp>
        <PortabilityPage />
      </TestApp>
    );

    expect(container.querySelector('a[href="/exit/start"]')).toBeTruthy();
    expect(screen.getByText("Start moving your account")).toBeInTheDocument();
    expect(screen.getByText(/You choose a media server/)).toBeInTheDocument();
    expect(screen.getByText(/published to the relay you choose/i)).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/still being built/i);
    expect(container).not.toHaveTextContent(/when destination \w+ is ready/i);
  });
});
