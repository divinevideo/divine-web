/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { AnalyticsPageTracker } from "./components/AnalyticsPageTracker";
import { AnalyticsUserTracker } from "./components/AnalyticsUserTracker";
import { useNostrLogin } from "@nostrify/react/login";
import { getSubdomainUser } from "./hooks/useSubdomainUser";

import Index from "./pages/Index";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";
import HomePage from "./pages/HomePage";
import DiscoveryPage from "./pages/DiscoveryPage";
import TrendingPage from "./pages/TrendingPage";
import HashtagPage from "./pages/HashtagPage";
import HashtagDiscoveryPage from "./pages/HashtagDiscoveryPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";
import VideoPage from "./pages/VideoPage";
import { TagPage } from "./pages/TagPage";
import ListsPage from "./pages/ListsPage";
import ListDetailPage from "./pages/ListDetailPage";
import ModerationSettingsPage from "./pages/ModerationSettingsPage";
// import { NIP05ProfilePage } from "./pages/NIP05ProfilePage";
import { UniversalUserPage } from "./pages/UniversalUserPage";
import AboutPage from "./pages/AboutPage";
import PrivacyPage from "./pages/PrivacyPage";
import OpenSourcePage from "./pages/OpenSourcePage";
import ProofModePage from "./pages/ProofModePage";
import AuthenticityPage from "./pages/AuthenticityPage";
import DMCAPage from "./pages/DMCAPage";
import HumanCreatedPage from "./pages/HumanCreatedPage";
import { SafetyPage } from "./pages/SafetyPage";
import { Support } from "./pages/Support";
import { FAQPage } from "./pages/FAQPage";
import { TermsPage } from "./pages/TermsPage";
import AppCallbackPage from "./pages/AppCallbackPage";
import { AppLayout } from "@/components/AppLayout";
import { DebugVideoPage } from "./pages/DebugVideoPage";
import LeaderboardPage from "./pages/LeaderboardPage";
// import { UploadPage } from "./pages/UploadPage"; // DISABLED: Upload route is commented out
export function AppRouter() {
  const { logins } = useNostrLogin();

  // Check if user is logged in
  const isLoggedIn = logins.length > 0;

  // Check if we're on a subdomain profile (username.divine.video)
  const subdomainUser = getSubdomainUser();

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnalyticsPageTracker />
      <AnalyticsUserTracker />
      <Routes>
        {/* Marketing/informational pages - no app layout */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/authenticity" element={<AuthenticityPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/open-source" element={<OpenSourcePage />} />
        <Route path="/proofmode" element={<ProofModePage />} />
        <Route path="/human-created" element={<HumanCreatedPage />} />
        <Route path="/dmca" element={<DMCAPage />} />
        <Route path="/safety" element={<SafetyPage />} />
        <Route path="/support" element={<Support />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/app/callback" element={<AppCallbackPage />} />

        {/* App routes - with AppLayout */}
        <Route element={<AppLayout />}>
          {/* Home/landing route - render profile directly on subdomain */}
          <Route path="/" element={
            subdomainUser
              ? <ProfilePage />
              : <Index />
          } />

          {/* Public browsing routes - accessible without login */}
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
          <Route path="/trending" element={<TrendingPage />} />
          <Route path="/hashtags" element={<HashtagDiscoveryPage />} />
          <Route path="/hashtag/:tag" element={<HashtagPage />} />
          <Route path="/t/:tag" element={<TagPage />} />
          <Route path="/profile/:npub" element={<ProfilePage />} />
          <Route path="/video/:id" element={<VideoPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/u/:userId" element={<UniversalUserPage />} />
          <Route path="/:nip19" element={<NIP19Page />} />

          {/* Protected routes - require login */}
          {isLoggedIn && (
            <>
              <Route path="/home" element={<HomePage />} />
              <Route path="/lists" element={<ListsPage />} />
              <Route path="/list/:pubkey/:listId" element={<ListDetailPage />} />
              {/* DISABLED: Upload route - not supported on web at this time
              <Route path="/upload" element={<UploadPage />} />
              */}
              <Route path="/settings/moderation" element={<ModerationSettingsPage />} />
              {/* Test pages for debugging */}
              <Route path="/debug-video" element={<DebugVideoPage />} />
            </>
          )}

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
