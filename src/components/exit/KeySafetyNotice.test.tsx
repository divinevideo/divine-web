import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TestApp } from "@/test/TestApp";

import { KeySafetyNotice } from "./KeySafetyNotice";

describe("KeySafetyNotice", () => {
  it("states where a secret key may safely be entered", () => {
    render(
      <TestApp>
        <KeySafetyNotice />
      </TestApp>
    );

    expect(
      screen.getByRole("heading", { name: "Never share your secret key" })
    ).toBeInTheDocument();
    expect(screen.getByText(/secret key \(nsec\)/)).toBeInTheDocument();
    expect(screen.getByText(/secret-key option on Divine's sign-in screen/)).toBeInTheDocument();
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
    expect(screen.getByText(/open divine\.video yourself/)).toBeInTheDocument();
  });
});
