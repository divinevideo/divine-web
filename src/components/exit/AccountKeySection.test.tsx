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
    render(<AccountKeySection pubkey={PUBKEY} hostedToken={null} isHostedAccount={false} localNsec={null} />);

    expect(screen.getByText(NPUB)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy public key" })).toBeInTheDocument();
  });

  it("copies the full npub and explains a clipboard rejection", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText")
      .mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    render(<AccountKeySection pubkey={PUBKEY} hostedToken={null} isHostedAccount={false} localNsec={null} />);

    await user.click(screen.getByRole("button", { name: "Copy public key" }));

    expect(writeText).toHaveBeenCalledWith(NPUB);
    expect(screen.getByRole("status")).toHaveTextContent(/could not be copied/);
  });

  it("renders signed-out, local-key, and external-signer states distinctly", () => {
    const { rerender } = render(
      <AccountKeySection pubkey={undefined} hostedToken={null} isHostedAccount={false} localNsec={null} />,
    );
    expect(screen.getByText(/Sign in to see the public key/)).toBeInTheDocument();

    rerender(<AccountKeySection pubkey={PUBKEY} hostedToken={null} isHostedAccount={false} localNsec={NSEC} />);
    expect(screen.getByText(/stored in this browser/)).toBeInTheDocument();
    expect(screen.getByText(`Local backup for ${NSEC}`)).toBeInTheDocument();

    rerender(<AccountKeySection pubkey={PUBKEY} hostedToken={null} isHostedAccount={false} localNsec={null} />);
    expect(screen.getByText(/browser extension or another signer/)).toBeInTheDocument();
  });

  it("requires confirmation, clears the password, and reveals the full nsec", async () => {
    mockExportAccountKey.mockResolvedValue({ nsec: NSEC });
    render(<AccountKeySection pubkey={PUBKEY} hostedToken="token" isHostedAccount localNsec={null} />);

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

    await userEvent.click(screen.getByRole('button', { name: 'Copy secret key' }));
    expect(screen.getByRole('status')).toHaveAttribute('data-sentry-mask');
  });

  it("keeps the local backup control available for a hosted account with a local key", () => {
    render(<AccountKeySection pubkey={PUBKEY} hostedToken="token" isHostedAccount localNsec={NSEC} />);

    expect(screen.getByLabelText("Divine account password")).toBeInTheDocument();
    expect(screen.getByText(`Local backup for ${NSEC}`)).toBeInTheDocument();
  });

  it("clears the revealed nsec on Hide and on account change", async () => {
    mockExportAccountKey.mockResolvedValue({ nsec: NSEC });
    const { rerender } = render(
      <AccountKeySection pubkey={PUBKEY} hostedToken="token" isHostedAccount localNsec={null} />,
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

    rerender(<AccountKeySection pubkey={OTHER_PUBKEY} hostedToken="other-token" isHostedAccount localNsec={null} />);
    await waitFor(() => expect(screen.queryByText(NSEC)).not.toBeInTheDocument());
  });

  it("ignores an export response that arrives after the account changes", async () => {
    let resolveExport: ((value: { nsec: string }) => void) | undefined;
    mockExportAccountKey.mockReturnValue(new Promise((resolve) => { resolveExport = resolve; }));
    const { rerender } = render(
      <AccountKeySection pubkey={PUBKEY} hostedToken="token" isHostedAccount localNsec={null} />,
    );

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));
    rerender(<AccountKeySection pubkey={OTHER_PUBKEY} hostedToken="other-token" isHostedAccount localNsec={null} />);
    resolveExport?.({ nsec: NSEC });

    await waitFor(() => expect(screen.queryByText(NSEC)).not.toBeInTheDocument());
    expect(mockExportAccountKey.mock.calls[0][0].signal.aborted).toBe(true);
  });

  it("keeps an in-flight export when the hosted token refreshes for the same account", async () => {
    let resolveExport: ((value: { nsec: string }) => void) | undefined;
    mockExportAccountKey.mockReturnValue(new Promise((resolve) => { resolveExport = resolve; }));
    const { rerender } = render(
      <AccountKeySection pubkey={PUBKEY} hostedToken="token-a" isHostedAccount localNsec={null} />,
    );

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));
    rerender(<AccountKeySection pubkey={PUBKEY} hostedToken="token-b" isHostedAccount localNsec={null} />);
    resolveExport?.({ nsec: NSEC });

    expect(await screen.findByText(NSEC)).toHaveAttribute("data-sentry-mask");
    expect(mockExportAccountKey.mock.calls[0][0].signal.aborted).toBe(false);
  });

  it("clears a revealed secret when the hosted session expires", async () => {
    mockExportAccountKey.mockResolvedValue({ nsec: NSEC });
    const { rerender } = render(
      <AccountKeySection pubkey={PUBKEY} hostedToken="token-a" isHostedAccount localNsec={null} />,
    );

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));
    expect(await screen.findByText(NSEC)).toBeInTheDocument();

    rerender(<AccountKeySection pubkey={PUBKEY} hostedToken={null} isHostedAccount localNsec={null} />);
    await waitFor(() => expect(screen.queryByText(NSEC)).not.toBeInTheDocument());

    rerender(<AccountKeySection pubkey={PUBKEY} hostedToken="token-b" isHostedAccount localNsec={null} />);
    expect(screen.getByLabelText("Divine account password")).toBeInTheDocument();
    expect(screen.queryByText(NSEC)).not.toBeInTheDocument();
  });

  it("turns policy denial into a restriction state", async () => {
    mockExportAccountKey.mockRejectedValue(new KeyExportError(
      "policy-denied",
      "Divine cannot export the secret key for this account.",
      403,
    ));
    render(<AccountKeySection pubkey={PUBKEY} hostedToken="token" isHostedAccount localNsec={null} />);

    await userEvent.type(screen.getByLabelText("Divine account password"), "password");
    await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show my secret key" }));

    expect(await screen.findByText(/Secret-key export is restricted/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('data-sentry-mask');
    expect(screen.queryByRole("button", { name: "Show my secret key" })).not.toBeInTheDocument();
  });

  it('prompts an expired hosted account to sign in again', () => {
    render(<AccountKeySection pubkey={PUBKEY} hostedToken={null} isHostedAccount localNsec={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i);
    expect(screen.getByRole('alert')).toHaveAttribute('data-sentry-mask');
    expect(screen.queryByText(/browser extension or another signer/)).not.toBeInTheDocument();
  });

  it('masks password failure from replay', async () => {
    mockExportAccountKey.mockRejectedValue(new KeyExportError(
      'invalid-password',
      'That password did not match this account.',
      401,
    ));
    render(<AccountKeySection pubkey={PUBKEY} hostedToken="token" isHostedAccount localNsec={null} />);

    await userEvent.type(screen.getByLabelText('Divine account password'), 'wrong password');
    await userEvent.click(screen.getByRole('checkbox', { name: /I understand/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Show my secret key' }));

    expect(await screen.findByRole('alert')).toHaveAttribute('data-sentry-mask');
  });
});
