import { nip19 } from "nostr-tools";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KeyExportError } from "@/lib/exit/keyExportClient";

import { AccountKeySection } from "./AccountKeySection";

const PUBKEY = "a".repeat(64);
const OTHER_PUBKEY = "b".repeat(64);
const NPUB = nip19.npubEncode(PUBKEY);
const NSEC = nip19.nsecEncode(new Uint8Array(32).fill(9));
const mockExportAccountKey = vi.fn();

vi.mock("@/lib/exit/keyExportClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exit/keyExportClient")>();
  return { ...actual, exportAccountKey: (...args: unknown[]) => mockExportAccountKey(...args) };
});

vi.mock("@/components/auth/LocalNsecBanner", () => ({
  LocalNsecBanner: ({ nsec }: { nsec: string }) => <div>Local backup for {nsec}</div>,
}));

describe("AccountKeySection", () => {
  beforeEach(() => {
    mockExportAccountKey.mockReset();
  });

  it("shows the full npub for every signed-in account", () => {
    render(<AccountKeySection pubkey={PUBKEY} hostedToken={null} localNsec={null} />);

    expect(screen.getByText(NPUB)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy public key" })).toBeInTheDocument();
  });

  it("copies the full npub and explains a clipboard rejection", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText")
      .mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    render(<AccountKeySection pubkey={PUBKEY} hostedToken={null} localNsec={null} />);

    await user.click(screen.getByRole("button", { name: "Copy public key" }));

    expect(writeText).toHaveBeenCalledWith(NPUB);
    expect(screen.getByRole("status")).toHaveTextContent(/could not be copied/);
  });

  it("renders signed-out, local-key, and external-signer states distinctly", () => {
    const { rerender } = render(
      <AccountKeySection pubkey={undefined} hostedToken={null} localNsec={null} />,
    );
    expect(screen.getByText(/Sign in to see the public key/)).toBeInTheDocument();

    rerender(<AccountKeySection pubkey={PUBKEY} hostedToken={null} localNsec={NSEC} />);
    expect(screen.getByText(/stored in this browser/)).toBeInTheDocument();
    expect(screen.getByText(`Local backup for ${NSEC}`)).toBeInTheDocument();

    rerender(<AccountKeySection pubkey={PUBKEY} hostedToken={null} localNsec={null} />);
    expect(screen.getByText(/browser extension or another signer/)).toBeInTheDocument();
  });

  it("requires confirmation, clears the password, and reveals the full nsec", async () => {
    mockExportAccountKey.mockResolvedValue({ nsec: NSEC });
    render(<AccountKeySection pubkey={PUBKEY} hostedToken="token" localNsec={null} />);

    const password = screen.getByLabelText("Divine account password");
    const reveal = screen.getByRole("button", { name: "Show my secret key" });
    await userEvent.type(password, "correct horse");
    expect(reveal).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(reveal);

    expect(await screen.findByText(NSEC)).toHaveAttribute("data-sentry-mask");
    expect(password).toHaveValue("");
    expect(mockExportAccountKey).toHaveBeenCalledWith(expect.objectContaining({
      token: "token",
      password: "correct horse",
    }));
  });

  it("keeps the local backup control available for a hosted account with a local key", () => {
    render(<AccountKeySection pubkey={PUBKEY} hostedToken="token" localNsec={NSEC} />);

    expect(screen.getByLabelText("Divine account password")).toBeInTheDocument();
    expect(screen.getByText(`Local backup for ${NSEC}`)).toBeInTheDocument();
  });

  it("clears the revealed nsec on Hide and on account change", async () => {
    mockExportAccountKey.mockResolvedValue({ nsec: NSEC });
    const { rerender } = render(
      <AccountKeySection pubkey={PUBKEY} hostedToken="token" localNsec={null} />,
    );

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));
    expect(await screen.findByText(NSEC)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hide secret key" }));
    expect(screen.queryByText(NSEC)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));
    expect(await screen.findByText(NSEC)).toBeInTheDocument();

    rerender(<AccountKeySection pubkey={OTHER_PUBKEY} hostedToken="other-token" localNsec={null} />);
    await waitFor(() => expect(screen.queryByText(NSEC)).not.toBeInTheDocument());
  });

  it("ignores an export response that arrives after the account changes", async () => {
    let resolveExport: ((value: { nsec: string }) => void) | undefined;
    mockExportAccountKey.mockReturnValue(new Promise((resolve) => { resolveExport = resolve; }));
    const { rerender } = render(
      <AccountKeySection pubkey={PUBKEY} hostedToken="token" localNsec={null} />,
    );

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));
    rerender(<AccountKeySection pubkey={OTHER_PUBKEY} hostedToken="other-token" localNsec={null} />);
    resolveExport?.({ nsec: NSEC });

    await waitFor(() => expect(screen.queryByText(NSEC)).not.toBeInTheDocument());
    expect(mockExportAccountKey.mock.calls[0][0].signal.aborted).toBe(true);
  });

  it("keeps an in-flight export when the hosted token refreshes for the same account", async () => {
    let resolveExport: ((value: { nsec: string }) => void) | undefined;
    mockExportAccountKey.mockReturnValue(new Promise((resolve) => { resolveExport = resolve; }));
    const { rerender } = render(
      <AccountKeySection pubkey={PUBKEY} hostedToken="token-a" localNsec={null} />,
    );

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));
    rerender(<AccountKeySection pubkey={PUBKEY} hostedToken="token-b" localNsec={null} />);
    resolveExport?.({ nsec: NSEC });

    expect(await screen.findByText(NSEC)).toHaveAttribute("data-sentry-mask");
    expect(mockExportAccountKey.mock.calls[0][0].signal.aborted).toBe(false);
  });

  it("turns policy denial into a restriction state", async () => {
    mockExportAccountKey.mockRejectedValue(new KeyExportError(
      "policy-denied",
      "Divine cannot export the secret key for this account.",
      403,
    ));
    render(<AccountKeySection pubkey={PUBKEY} hostedToken="token" localNsec={null} />);

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));

    expect(await screen.findByText(/Secret-key export is restricted/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show my secret key" })).not.toBeInTheDocument();
  });
});
