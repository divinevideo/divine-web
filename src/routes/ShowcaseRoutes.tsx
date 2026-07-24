/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ABOUTME: Route table for showcase mode — documents, downloads, and a curated reel
// ABOUTME: No login, no feeds, no profiles; deliberately small enough to audit at a glance

import { Route, Routes } from "react-router-dom";

import ShowcasePage from "@/pages/ShowcasePage";
import ShowcaseVideoPage from "@/pages/ShowcaseVideoPage";
import MerchPage from "@/pages/MerchPage";
import NotFound from "@/pages/NotFound";
import AppCallbackPage from "@/pages/AppCallbackPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import InvitesLandingPage from "@/pages/InvitesLandingPage";
import { MarketingLayout } from "@/components/MarketingLayout";
import { documentRoutes } from "@/routes/documentRoutes";
import { devRoutes } from "@/routes/devRoutes";

/**
 * Every route the public web serves in showcase mode.
 *
 * The callback and invite routes stay because the mobile apps deep-link into
 * them: /auth/callback and /app/callback complete hosted sign-in flows started
 * in-app, and /invite/:code is the shared invite landing. Removing them would
 * break the apps, not just the website.
 *
 * Anything not listed here 404s — that includes every feed, profile, hashtag,
 * search and single-video route from the legacy client.
 */
export default function ShowcaseRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ShowcasePage />} />

      {/* Target of shared video links. Safety-gated in the page, so a crafted
          id can't surface age-gated content; the worker already emits OG tags
          for /video/* so social previews work. */}
      <Route path="/video/:id" element={<ShowcaseVideoPage />} />

      {documentRoutes()}

      {/* MerchPage has no layout of its own; it relied on the app shell before. */}
      <Route
        path="/merch"
        element={
          <MarketingLayout>
            <MerchPage />
          </MarketingLayout>
        }
      />

      {/* Dev-only brand primitives preview — tree-shaken in production */}
      {devRoutes()}

      {/* Mobile deep-link targets — see the note above before removing. */}
      <Route path="/app/callback" element={<AppCallbackPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/invite/:code" element={<InvitesLandingPage />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
