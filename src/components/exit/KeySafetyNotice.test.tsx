import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TestApp } from "@/test/TestApp";

import { KeySafetyNotice } from "./KeySafetyNotice";

describe("KeySafetyNotice", () => {
  it("states that Divine never asks for a secret key", () => {
    render(
      <TestApp>
        <KeySafetyNotice />
      </TestApp>
    );

    expect(
      screen.getByRole("heading", { name: "Divine will never ask for your secret key" })
    ).toBeInTheDocument();
    expect(screen.getByText(/secret key \(nsec\)/)).toBeInTheDocument();
    expect(screen.getByText(/Anyone who does is not Divine/)).toBeInTheDocument();
  });

  it("tells readers they can reach the tool without trusting a link", () => {
    render(
      <TestApp>
        <KeySafetyNotice />
      </TestApp>
    );

    expect(
      screen.getByText(/You never need a link to reach this page/)
    ).toBeInTheDocument();
    expect(screen.getByText(/go to divine\.video\/exit yourself and sign in/)).toBeInTheDocument();
  });
});
