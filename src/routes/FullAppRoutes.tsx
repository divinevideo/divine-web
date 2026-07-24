/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ABOUTME: Route table for the legacy full Nostr client — feeds, profiles, login, messages
// ABOUTME: Only loaded when VITE_WEB_MODE=full; showcase builds never pull this chunk

import { Route, Routes } from "react-router-dom";
import { getSubdomainUser } from "@/hooks/useSubdomainUser";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import Index from "@/pages/Index";
import { NIP19Page } from "@/pages/NIP19Page";
import NotFound from "@/pages/NotFound";
import HomePage from "@/pages/HomePage";
import DiscoveryPage from "@/pages/DiscoveryPage";
import TrendingPage from "@/pages/TrendingPage";
import PopularPage from "@/pages/PopularPage";
import HashtagPage from "@/pages/HashtagPage";
import CategoryPage from "@/pages/CategoryPage";
import CategoriesIndexPage from "@/pages/CategoriesIndexPage";
import HashtagDiscoveryPage from "@/pages/HashtagDiscoveryPage";
import ProfilePage from "@/pages/ProfilePage";
import SearchPage from "@/pages/SearchPage";
import VideoPage from "@/pages/VideoPage";
import { LegacyVineVideoPage } from "@/pages/LegacyVineVideoPage";
import { TagPage } from "@/pages/TagPage";
import ListsPage from "@/pages/ListsPage";
import ListDetailPage from "@/pages/ListDetailPage";
import ModerationSettingsPage from "@/pages/ModerationSettingsPage";
import LinkedAccountsSettingsPage from "@/pages/LinkedAccountsSettingsPage";
import { UniversalUserPage } from "@/pages/UniversalUserPage";
import EventPage from "@/pages/EventPage";
import MerchPage from "@/pages/MerchPage";
import GetEmbedPage from "@/pages/GetEmbedPage";
import AppCallbackPage from "@/pages/AppCallbackPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import InvitesLandingPage from "@/pages/InvitesLandingPage";
import { AppLayout } from "@/components/AppLayout";
import { DebugVideoPage } from "@/pages/DebugVideoPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import NotificationsPage from "@/pages/NotificationsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import MessagesPage from "@/pages/MessagesPage";
import ConversationPage from "@/pages/ConversationPage";
import CollabsPage from "@/pages/CollabsPage";
import { documentRoutes } from "@/routes/documentRoutes";
import { devRoutes } from "@/routes/devRoutes";
// import { UploadPage } from "@/pages/UploadPage"; // DISABLED: Upload route is commented out

export default function FullAppRoutes() {
  const { user, isResolvingJwt } = useCurrentUser();

  // Treat an in-flight hosted-JWT session as "still determining auth", not
  // "logged out" — otherwise the protected routes below unmount during the
  // getPublicKey() round-trip and a reload bounces the user off the page.
  //
  // Tradeoff (intentional): while resolving, `user` is still undefined, so a
  // protected page renders its own brief logged-out fallback (e.g. LoginArea)
  // until the pubkey lands. That sub-second fallback is strictly better than the
  // previous behavior, which unmounted the route entirely and discarded the URL.
  // A resolving-aware loading state on protected pages is a possible follow-up;
  // it's deliberately out of scope for this precedence fix.
  const isLoggedIn = Boolean(user) || isResolvingJwt;

  // Check if we're on a subdomain profile (username.divine.video)
  const subdomainUser = getSubdomainUser();

  const appShellRoutes = (
    <>
      {/* Public browsing routes - accessible without login */}
      <Route path="/discovery" element={<DiscoveryPage />} />
      <Route path="/discovery/:tab" element={<DiscoveryPage />} />
      <Route path="/trending" element={<TrendingPage />} />
      <Route path="/popular" element={<PopularPage />} />
      <Route path="/hashtags" element={<HashtagDiscoveryPage />} />
      <Route path="/hashtag/:tag" element={<HashtagPage />} />
      <Route path="/category" element={<CategoriesIndexPage />} />
      <Route path="/category/:name" element={<CategoryPage />} />
      <Route path="/t/:tag" element={<TagPage />} />
      <Route path="/profile/:npub" element={<ProfilePage />} />
      <Route path="/video/:id" element={<VideoPage />} />
      <Route path="/v/:legacyVineId" element={<LegacyVineVideoPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/merch" element={<MerchPage />} />
      <Route path="/u/:userId" element={<UniversalUserPage />} />
      <Route path="/list/:pubkey/:listId" element={<ListDetailPage />} />
      <Route path="/event/:eventId" element={<EventPage />} />
      <Route path="/event/a/:kind/:pubkey/:identifier" element={<EventPage />} />
      <Route path="/:nip19" element={<NIP19Page />} />

      {/* Protected routes - require login */}
      {isLoggedIn && (
        <>
          <Route path="/home" element={<HomePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:conversationId" element={<ConversationPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/lists" element={<ListsPage />} />
          {/* DISABLED: Upload route - not supported on web at this time
          <Route path="/upload" element={<UploadPage />} />
          */}
          <Route path="/collabs" element={<CollabsPage />} />
          <Route path="/collabs/:tab" element={<CollabsPage />} />
          <Route path="/settings/moderation" element={<ModerationSettingsPage />} />
          <Route path="/settings/linked-accounts" element={<LinkedAccountsSettingsPage />} />
          {/* Test pages for debugging */}
          <Route path="/debug-video" element={<DebugVideoPage />} />
        </>
      )}

      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </>
  );

  return (
    <Routes>
      {/* Marketing/informational pages - no app layout */}
      {/* /about redirects to about.divine.video via _redirects (301) */}
      {documentRoutes()}
      <Route path="/get-embed" element={<GetEmbedPage />} />
      <Route path="/app/callback" element={<AppCallbackPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/invite/:code" element={<InvitesLandingPage />} />

      {/* Dev-only brand primitives preview — tree-shaken in production */}
      {devRoutes()}

      <Route element={<AppLayout />}>
        {/* Home/landing route - render profile directly on subdomain */}
        <Route path="/" element={subdomainUser ? <ProfilePage /> : <Index />} />
        {appShellRoutes}
      </Route>
    </Routes>
  );
}
