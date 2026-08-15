import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TestApp } from "@/test/TestApp";
import { createFixtureFetch } from "@/lib/exit/__fixtures__/fixtureFetch";
import { FixtureSigner } from "@/lib/exit/__fixtures__/fixtureSigner";
import { fixturePubkey } from "@/lib/exit/__fixtures__/exportFixtures";

import { ExitStartPage } from "./ExitStartPage";

vi.mock("@/components/MarketingLayout", () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockUseCurrentUser = vi.fn();
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

function signedIn() {
  const signer = new FixtureSigner();
  return { user: { pubkey: fixturePubkey, signer }, signer, isResolvingJwt: false };
}

function signedOut() {
  return { user: undefined, signer: undefined, isResolvingJwt: false };
}

describe("ExitStartPage", () => {
  beforeEach(() => {
    mockUseCurrentUser.mockReturnValue(signedOut());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("asks a signed-out visitor to sign in and offers no export action", () => {
    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    expect(
      screen.getByRole("heading", { name: "Take your Divine data with you" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Sign in to export your account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create my archive/ })).not.toBeInTheDocument();
  });

  it("offers the export action once signed in", () => {
    mockUseCurrentUser.mockReturnValue(signedIn());

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    expect(screen.getByRole("button", { name: /Create my archive/ })).toBeInTheDocument();
    expect(screen.queryByText(/Sign in to export your account/)).not.toBeInTheDocument();
  });

  it("builds an archive from the owner export and enables the download", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    vi.stubGlobal("fetch", createFixtureFetch("multi-page"));

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));

    await waitFor(() => {
      expect(screen.getByText(/Your archive is ready/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Download archive/ })).toBeEnabled();
    expect(
      screen.getByText(/2 pages read, 2 events and 2 media references collected from Divine/)
    ).toBeInTheDocument();
  });

  it("explains the failure when Divine rejects the export", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    vi.stubGlobal("fetch", createFixtureFetch("server-failure"));

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));

    await waitFor(() => {
      expect(
        screen.getByText("Divine could not finish this export right now. Try again later.")
      ).toBeInTheDocument();
    });
  });

  it("does not ask an already-signed-in visitor to sign in while the session resolves", () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined, signer: undefined, isResolvingJwt: true });

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    expect(screen.queryByText(/Sign in to export your account/)).not.toBeInTheDocument();
    expect(screen.getByText(/Checking your Divine session/)).toBeInTheDocument();
  });

  it("disables the export when the session cannot sign", () => {
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: fixturePubkey },
      signer: undefined,
      isResolvingJwt: false,
    });

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    expect(screen.getByRole("button", { name: /Create my archive/ })).toBeDisabled();
    expect(screen.getByText(/This session cannot sign the export request/)).toBeInTheDocument();
  });

  it("tells a hosted-signer account where its signing key lives", () => {
    mockUseCurrentUser.mockReturnValue(signedIn());

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    expect(screen.getByText(/Divine's signer holds the key for this account/)).toBeInTheDocument();
  });
});
