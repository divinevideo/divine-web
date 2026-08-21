// ABOUTME: Tests device-specific store choices on the public download page
// ABOUTME: Keeps desktop and unrecognized devices on a safe all-store fallback

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_STORE_URL, PLAY_STORE_URL, ZAP_STORE_URL } from "@/lib/mobileStoreLinks";
import { TestApp } from "@/test/TestApp";

import { DownloadPage } from "./DownloadPage";

vi.mock("@/components/MarketingLayout", () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderPage(userAgent: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
  return render(
    <TestApp>
      <DownloadPage />
    </TestApp>
  );
}

describe("DownloadPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows only the App Store as the primary choice on iOS", () => {
    renderPage("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");

    expect(screen.getByRole("heading", { name: "Get Divine" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download Divine on the App Store" })).toHaveAttribute("href", APP_STORE_URL);
    expect(screen.queryByRole("link", { name: "Get Divine on Google Play" })).not.toBeInTheDocument();
  });

  it("shows only Google Play as the primary choice on Android", () => {
    renderPage("Mozilla/5.0 (Linux; Android 15; Pixel 9)");

    expect(screen.getByRole("link", { name: "Get Divine on Google Play" })).toHaveAttribute("href", PLAY_STORE_URL);
    expect(screen.queryByRole("link", { name: "Download Divine on the App Store" })).not.toBeInTheDocument();
  });

  it("shows both stores and ZapStore on desktop and unrecognized devices", () => {
    renderPage("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");

    expect(screen.getByRole("link", { name: "Download Divine on the App Store" })).toHaveAttribute("href", APP_STORE_URL);
    expect(screen.getByRole("link", { name: "Get Divine on Google Play" })).toHaveAttribute("href", PLAY_STORE_URL);
    expect(screen.getByRole("link", { name: "Get Divine on ZapStore" })).toHaveAttribute(
      "href",
      ZAP_STORE_URL
    );
  });
});
