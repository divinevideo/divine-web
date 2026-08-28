import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TestApp } from "@/test/TestApp";
import { createFixtureFetch } from "@/lib/exit/__fixtures__/fixtureFetch";
import { FixtureSigner } from "@/lib/exit/__fixtures__/fixtureSigner";
import { KeyExportError } from "@/lib/exit/keyExportClient";
import {
  fixturePubkey,
  fixtureMediaHash,
  makeFixtureEvent,
  otherFixturePubkey,
} from "@/lib/exit/__fixtures__/exportFixtures";

import { ExitStartPage } from "./ExitStartPage";

vi.mock("@/components/MarketingLayout", () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockUseCurrentUser = vi.fn();
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const { mockGetActiveLocalNsecLogin, mockBannerRender, mockExportAccountKey } = vi.hoisted(() => ({
  mockGetActiveLocalNsecLogin: vi.fn(
    (_logins: unknown[] = [], _pubkey = "") => null as { data: { nsec: string } } | null
  ),
  mockBannerRender: vi.fn(() => null as React.ReactNode),
  mockExportAccountKey: vi.fn(),
}));

vi.mock("@/lib/exit/keyExportClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exit/keyExportClient")>();
  return { ...actual, exportAccountKey: (...args: unknown[]) => mockExportAccountKey(...args) };
});

vi.mock("@/lib/localNsecAccount", () => ({
  getLocalNsecLogin: (logins: unknown[], pubkey: string) =>
    mockGetActiveLocalNsecLogin(logins, pubkey),
}));

// The real banner gates itself for protected minors by rendering null. Mocking
// it lets that case be reproduced directly.
vi.mock("@/components/auth/LocalNsecBanner", () => ({
  LocalNsecBanner: () => mockBannerRender(),
}));

function signedIn() {
  const signer = new FixtureSigner();
  return {
    user: { pubkey: fixturePubkey, signer },
    signer,
    hostedToken: null,
    isHostedAccount: false,
    isResolvingJwt: false,
  };
}

function hostedSignedIn() {
  const signer = new FixtureSigner();
  return {
    user: { pubkey: fixturePubkey, signer },
    signer,
    hostedToken: "token",
    isHostedAccount: true,
    isResolvingJwt: false,
  };
}

function signedOut() {
  return { user: undefined, signer: undefined, isResolvingJwt: false };
}

describe("ExitStartPage", () => {
  beforeEach(() => {
    mockUseCurrentUser.mockReturnValue(signedOut());
    mockGetActiveLocalNsecLogin.mockReturnValue(null);
    mockBannerRender.mockReturnValue(null);
    mockExportAccountKey.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
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
    expect(mockGetActiveLocalNsecLogin).toHaveBeenCalledWith(expect.any(Array), fixturePubkey);
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

  it("validates a custom Blossom destination inline", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    vi.stubGlobal("fetch", createFixtureFetch("one-page"));
    render(<TestApp><ExitStartPage /></TestApp>);
    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Move your media" })).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Blossom server URL"), "http://blossom.example");
    await userEvent.click(screen.getByRole("button", { name: "Copy my media" }));

    expect(screen.getByText("Use an HTTPS Blossom server URL.")).toBeInTheDocument();
  });

  it("rejects a Blossom destination with an endpoint path", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    vi.stubGlobal("fetch", createFixtureFetch("one-page"));
    render(<TestApp><ExitStartPage /></TestApp>);
    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Move your media" })).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Blossom server URL"), "https://blossom.example/path");
    await userEvent.click(screen.getByRole("button", { name: "Copy my media" }));

    expect(screen.getByText("Blossom servers answer at the domain root. Use https://blossom.example instead.")).toBeInTheDocument();
  });

  it("reports destination mirror counts", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    vi.stubGlobal("fetch", createFixtureFetch("one-page"));
    render(<TestApp><ExitStartPage /></TestApp>);
    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Move your media" })).toBeInTheDocument());

    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        url: `https://blossom.example/${fixtureMediaHash}`,
        sha256: fixtureMediaHash,
        size: 5,
        type: "video/mp4",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "5" } })));
    await userEvent.type(screen.getByLabelText("Blossom server URL"), "https://blossom.example");
    await userEvent.click(screen.getByRole("button", { name: "Copy my media" }));

    await waitFor(() => expect(screen.getByText("Destination copy finished.")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("1 mirrored, 0 failed, 0 skipped, and 0 unverified.");
    expect(screen.getByRole("heading", { name: "Move your posts" })).toBeInTheDocument();
    expect(screen.getByLabelText("Relay URL")).toBeInTheDocument();
  });

  it("explains the media limitation when direct file saving is unavailable", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    vi.stubGlobal("fetch", createFixtureFetch("one-page"));
    render(<TestApp><ExitStartPage /></TestApp>);
    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));
    await waitFor(() => expect(screen.getByText(/Your archive is ready/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Save media archive/ })).toBeDisabled();
    expect(screen.getByText(/cannot safely assemble one large media archive/)).toBeInTheDocument();
  });

  it("streams media to a selected file and reports a quarantined mismatch", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    vi.stubGlobal("fetch", createFixtureFetch("one-page"));
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const abort = vi.fn(async () => undefined);
    vi.stubGlobal("showSaveFilePicker", vi.fn(async () => ({
      createWritable: async () => ({ write, close, abort }),
    })));
    render(<TestApp><ExitStartPage /></TestApp>);
    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));
    await waitFor(() => expect(screen.getByText(/Your archive is ready/)).toBeInTheDocument());
    vi.stubGlobal("fetch", vi.fn(async () => new Response("hello", { headers: { "content-type": "video/mp4" } })));
    await userEvent.click(screen.getByRole("button", { name: /Save media archive/ }));
    await waitFor(() => expect(screen.getByText("Your media archive is saved.")).toBeInTheDocument());
    expect(screen.getByText(/Saved separately because the hash did not match/)).toBeInTheDocument();
    expect(write).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(abort).not.toHaveBeenCalled();
  });

  it("uses the active Funnelcake environment", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    localStorage.setItem("divine_dev_funnelcake_api_mode", "staging");
    const fetcher = vi.fn(createFixtureFetch("one-page"));
    vi.stubGlobal("fetch", fetcher);

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());

    expect(String(fetcher.mock.calls[0][0])).toMatch(/^https:\/\/api\.staging\.divine\.video\//);
  });

  it("clears a completed archive when the active account changes", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    vi.stubGlobal("fetch", createFixtureFetch("one-page"));

    const view = render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Download archive/ })).toBeEnabled());

    const signer = new FixtureSigner();
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: otherFixturePubkey, signer },
      signer,
      isResolvingJwt: false,
    });
    view.rerender(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /Download archive/ })).toBeDisabled());
    expect(screen.queryByText("Your archive is ready.")).not.toBeInTheDocument();
  });

  it("explains when the archive download cannot be created", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    vi.stubGlobal("fetch", createFixtureFetch("one-page"));

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));

    await waitFor(() => {
      expect(screen.getByText(/Your archive is ready/)).toBeInTheDocument();
    });

    const originalCreateObjectURL = URL.createObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: undefined,
    });

    await userEvent.click(screen.getByRole("button", { name: /Download archive/ }));

    expect(
      screen.getByText("This browser cannot create the archive download. Try another browser.")
    ).toBeInTheDocument();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
  });

  it("offers a partial archive but says it is incomplete", async () => {
    mockUseCurrentUser.mockReturnValue(signedIn());

    let requests = 0;
    vi.stubGlobal("fetch", async () => {
      requests += 1;
      if (requests === 1) {
        return new Response(
          JSON.stringify({
            data: [makeFixtureEvent()],
            pagination: { next_cursor: "cursor-one", has_more: true },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ error: "boom" }), { status: 503 });
    });

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    await userEvent.click(screen.getByRole("button", { name: /Create my archive/ }));

    await waitFor(() => {
      expect(screen.getByText(/This archive is incomplete/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Download archive/ })).toBeEnabled();
    expect(screen.queryByText("Your archive is ready.")).not.toBeInTheDocument();
    expect(
      screen.getByText("Divine could not finish this export right now. Try again later.")
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

  it("carries the standing key-safety notice even when signed out", () => {
    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    expect(
      screen.getByRole("heading", { name: "Never share your secret key" })
    ).toBeInTheDocument();
  });

  it("explains accounts whose key is managed by another signer", () => {
    mockUseCurrentUser.mockReturnValue(signedIn());

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    expect(screen.getByText(/signs through a browser extension or another signer/)).toBeInTheDocument();
    expect(
      screen.getByText(/everything in your downloaded archive stays verifiable/)
    ).toBeInTheDocument();
  });

  it("keeps portability controls available when hosted key export is restricted", async () => {
    mockUseCurrentUser.mockReturnValue(hostedSignedIn());
    mockExportAccountKey.mockRejectedValue(new KeyExportError(
      "policy-denied",
      "Divine cannot export the secret key for this account.",
      403,
    ));
    vi.stubGlobal("fetch", createFixtureFetch("one-page"));
    render(<TestApp><ExitStartPage /></TestApp>);

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));
    expect(await screen.findByText(/Secret-key export is restricted/)).toBeInTheDocument();

    const archiveButton = screen.getByRole("button", { name: /Create my archive/ });
    expect(archiveButton).toBeEnabled();
    await userEvent.click(archiveButton);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Move your media" })).toBeInTheDocument());

    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        url: `https://blossom.example/${fixtureMediaHash}`,
        sha256: fixtureMediaHash,
        size: 5,
        type: "video/mp4",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "5" } })));
    await userEvent.type(screen.getByLabelText("Blossom server URL"), "https://blossom.example");
    const mirrorButton = screen.getByRole("button", { name: "Copy my media" });
    expect(mirrorButton).toBeEnabled();
    await userEvent.click(mirrorButton);

    await waitFor(() => expect(screen.getByRole("button", { name: "Publish my posts" })).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText("Relay URL"), "wss://relay.example");
    expect(screen.getByRole("button", { name: "Publish my posts" })).toBeEnabled();
    expect(screen.getByText(/Secret-key export is restricted/)).toBeInTheDocument();
  });

  it("still explains the keys section when the backup banner renders nothing", () => {
    mockUseCurrentUser.mockReturnValue(signedIn());
    mockGetActiveLocalNsecLogin.mockReturnValue({ data: { nsec: "nsec1example" } });
    mockBannerRender.mockReturnValue(null);

    render(
      <TestApp>
        <ExitStartPage />
      </TestApp>
    );

    expect(
      screen.getByText(/This account has its own key, stored in this browser/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/signs through a browser extension or another signer/)
    ).not.toBeInTheDocument();
  });
});
