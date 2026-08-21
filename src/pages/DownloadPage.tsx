// ABOUTME: Public device-aware landing page for downloading the Divine mobile app
// ABOUTME: Offers store choices without redirecting visitors or requiring an account

import { AppleLogo, DeviceMobile, GooglePlayLogo } from "@phosphor-icons/react";
import { useHead } from "@unhead/react";
import { useState } from "react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import {
  APP_STORE_URL,
  detectMobilePlatform,
  PLAY_STORE_URL,
  ZAP_STORE_URL,
} from "@/lib/mobileStoreLinks";

export function DownloadPage() {
  const [platform] = useState(() => detectMobilePlatform(window.navigator.userAgent));
  const showAppStore = platform !== "android";
  // Google Play and Zapstore both hand out the Android build, so neither
  // has anything an iOS visitor can install.
  const showAndroidStores = platform !== "ios";

  useHead({
    title: "Download Divine",
    link: [{ rel: "canonical", href: "https://divine.video/download" }],
    meta: [{ name: "description", content: "Get Divine from the App Store, Google Play, or Zapstore." }],
  });

  return (
    <MarketingLayout>
      <main className="bg-brand-dark-green text-brand-off-white">
        <div className="container mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center md:py-24">
          <div className="mb-6 flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-green">
            <DeviceMobile weight="fill" className="h-4 w-4" />
            <span>Divine mobile app</span>
          </div>
          <h1 className="mb-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-brand-off-white md:text-6xl">
            Get Divine
          </h1>
          <p className="mb-10 max-w-2xl text-lg leading-relaxed text-brand-light-green md:text-xl">
            Six-second loops from real humans, ready for your phone.
          </p>
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-center">
            {showAppStore && (
              <Button asChild variant="sticker" size="lg">
                <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Download Divine on the App Store">
                  <AppleLogo weight="fill" className="h-5 w-5" />
                  App Store
                </a>
              </Button>
            )}
            {showAndroidStores && (
              <Button asChild variant="sticker" size="lg">
                <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Get Divine on Google Play">
                  <GooglePlayLogo weight="fill" className="h-5 w-5" />
                  Google Play
                </a>
              </Button>
            )}
          </div>
          {showAndroidStores && (
            <a
              href={ZAP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 text-sm font-semibold text-brand-off-white/80 underline decoration-brand-green/70 underline-offset-4 transition-colors hover:text-brand-green"
            >
              Get Divine on Zapstore
            </a>
          )}
        </div>
      </main>
    </MarketingLayout>
  );
}
