/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { SignInLoading } from "./components/auth/SignInLoading";
import { AnalyticsPageTracker } from "./components/AnalyticsPageTracker";
import { AnalyticsUserTracker } from "./components/AnalyticsUserTracker";
import { getSubdomainUser } from "./hooks/useSubdomainUser";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { classifyInvitePath } from "@/lib/chat/invite";
import { ChatInviteProvider } from "@/contexts/ChatInviteProvider";

import Index from "./pages/Index";
import DiscoveryPage from "./pages/DiscoveryPage";
import { AppLayout } from "@/components/AppLayout";

// Code-split secondary routes so first-time visitors landing on `/` or
// `/discovery/*` don't download settings, DM crypto, archive export, legal,
// or moderation bundles before first paint.
const NIP19Page = lazy(() => import("./pages/NIP19Page").then((m) => ({ default: m.NIP19Page })));
const NotFound = lazy(() => import("./pages/NotFound"));
const HomePage = lazy(() => import("./pages/HomePage"));
const TrendingPage = lazy(() => import("./pages/TrendingPage"));
const PopularPage = lazy(() => import("./pages/PopularPage"));
const HashtagPage = lazy(() => import("./pages/HashtagPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const CategoriesIndexPage = lazy(() => import("./pages/CategoriesIndexPage"));
const HashtagDiscoveryPage = lazy(() => import("./pages/HashtagDiscoveryPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const VideoPage = lazy(() => import("./pages/VideoPage"));
const LegacyVineVideoPage = lazy(() => import("./pages/LegacyVineVideoPage").then((m) => ({ default: m.LegacyVineVideoPage })));
const TagPage = lazy(() => import("./pages/TagPage").then((m) => ({ default: m.TagPage })));
const ListsPage = lazy(() => import("./pages/ListsPage"));
const ListDetailPage = lazy(() => import("./pages/ListDetailPage"));
const PeopleListDetailPage = lazy(() => import("./pages/PeopleListDetailPage"));
const ProfileListsPage = lazy(() => import("./pages/ProfileListsPage"));
const ModerationSettingsPage = lazy(() => import("./pages/ModerationSettingsPage"));
const LinkedAccountsSettingsPage = lazy(() => import("./pages/LinkedAccountsSettingsPage"));
const SupportersPage = lazy(() => import("./pages/SupportersPage"));
const RelaysSettingsPage = lazy(() => import("./pages/RelaysSettingsPage"));
const UniversalUserPage = lazy(() => import("./pages/UniversalUserPage").then((m) => ({ default: m.UniversalUserPage })));
const EventPage = lazy(() => import("./pages/EventPage"));

const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const OpenSourcePage = lazy(() => import("./pages/OpenSourcePage"));
const ProofModePage = lazy(() => import("./pages/ProofModePage"));
const AuthenticityPage = lazy(() => import("./pages/AuthenticityPage"));
const DMCAPage = lazy(() => import("./pages/DMCAPage"));
const HumanCreatedPage = lazy(() => import("./pages/HumanCreatedPage"));
const SafetyPage = lazy(() => import("./pages/SafetyPage").then((m) => ({ default: m.SafetyPage })));
const FamilyHubPage = lazy(() => import("./pages/family/FamilyHubPage").then((m) => ({ default: m.FamilyHubPage })));
const TalkingToYourTeenPage = lazy(() => import("./pages/family/TalkingToYourTeenPage").then((m) => ({ default: m.TalkingToYourTeenPage })));
const MediaPlanPage = lazy(() => import("./pages/family/MediaPlanPage").then((m) => ({ default: m.MediaPlanPage })));
const WhenSomethingGoesWrongPage = lazy(() => import("./pages/family/WhenSomethingGoesWrongPage").then((m) => ({ default: m.WhenSomethingGoesWrongPage })));
const SafetyToolsPage = lazy(() => import("./pages/family/SafetyToolsPage").then((m) => ({ default: m.SafetyToolsPage })));
const AgeReviewPage = lazy(() => import("./pages/AgeReviewPage").then((m) => ({ default: m.AgeReviewPage })));
const KidsPolicyPage = lazy(() => import("./pages/KidsPolicyPage").then((m) => ({ default: m.KidsPolicyPage })));
const PortabilityPage = lazy(() => import("./pages/PortabilityPage").then((m) => ({ default: m.PortabilityPage })));
const DownloadPage = lazy(() => import("./pages/DownloadPage").then((m) => ({ default: m.DownloadPage })));
const ExitStartPage = lazy(() => import("./pages/ExitStartPage").then((m) => ({ default: m.ExitStartPage })));
const DeleteAccountPage = lazy(() => import("./pages/DeleteAccountPage").then((m) => ({ default: m.DeleteAccountPage })));
const Support = lazy(() => import("./pages/Support").then((m) => ({ default: m.Support })));
const FAQPage = lazy(() => import("./pages/FAQPage").then((m) => ({ default: m.FAQPage })));
const ServicesPage = lazy(() => import("./pages/ServicesPage").then((m) => ({ default: m.ServicesPage })));
const MerchPage = lazy(() => import("./pages/MerchPage"));
const TermsPage = lazy(() => import("./pages/TermsPage").then((m) => ({ default: m.TermsPage })));
const GetEmbedPage = lazy(() => import("./pages/GetEmbedPage"));
const AppCallbackPage = lazy(() => import("./pages/AppCallbackPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const LegacyInviteRedirectPage = lazy(() => import("./pages/LegacyInviteRedirectPage").then((m) => ({ default: m.LegacyInviteRedirectPage })));
const DebugVideoPage = lazy(() => import("./pages/DebugVideoPage").then((m) => ({ default: m.DebugVideoPage })));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const ConversationPage = lazy(() => import("./pages/ConversationPage"));
const CollabsPage = lazy(() => import("./pages/CollabsPage"));
// import { UploadPage } from "./pages/UploadPage"; // DISABLED: Upload route is commented out

// Dev-only: static preview surface for the brand system. The `lazy()` call
// sits behind `import.meta.env.DEV` so Vite's dead-code elimination drops both
// the route registration AND the async chunk reference from production builds.
const BrandPreview = import.meta.env.DEV
  ? lazy(() => import("./pages/_BrandPreview"))
  : null;
const ChatPage = lazy(() => import("./pages/chat/ChatPage"));

// Concord invite links are /invite/<naddr>#<fragment>, which shares its shape
// with the retired /invite/:code links; only naddr codes reach the chat page.
function InviteLinkRoute({
  hasUser,
  isSessionResolving,
}: {
  hasUser: boolean;
  isSessionResolving: boolean;
}) {
  const { pathname } = useLocation();
  if (classifyInvitePath(pathname).real) {
    return (
      <Suspense fallback={null}>
        <ChatPage />
      </Suspense>
    );
  }
  return (
    <LegacyInviteRedirectPage
      hasUser={hasUser}
      isSessionResolving={isSessionResolving}
    />
  );
}

export function AppRouter() {
  const { user, isAuthPending, isRenewingSession } = useCurrentUser();

  // Treat sign-in that is still loading (a hosted session resolving, or a saved
  // extension login waiting for the extension) as "still determining auth",
  // not "logged out" — otherwise the protected routes below unmount and a
  // reload shows the not-found page.
  const isLoggedIn = Boolean(user) || isAuthPending;

  // While sign-in loads, the protected routes show a loading state instead of
  // the page, which would otherwise render its own signed-out fallback. A hosted
  // session renewing its token has no user for a moment too, but for the
  // account already on screen; the page stays mounted through that and keeps
  // what it holds, such as a half-written message.
  const showsProtectedPage = Boolean(user) || isRenewingSession;

  // Check if we're on a subdomain profile (username.divine.video)
  const subdomainUser = getSubdomainUser();

  const appShellRoutes = (
    <>
      {/* Public browsing routes - accessible without login */}
      <Route path="/discovery/new" element={<Navigate to="/discovery/hot" replace />} />
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
      <Route path="/profile/:npub/lists" element={<ProfileListsPage />} />
      <Route path="/video/:id" element={<VideoPage />} />
      <Route path="/v/:legacyVineId" element={<LegacyVineVideoPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/merch" element={<MerchPage />} />
      <Route path="/supporters" element={<SupportersPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/u/:userId" element={<UniversalUserPage />} />
      <Route path="/list/:pubkey/:listId" element={<ListDetailPage />} />
      <Route path="/people-lists/:pubkey/:listId" element={<PeopleListDetailPage />} />
      <Route path="/event/:eventId" element={<EventPage />} />
      <Route path="/event/a/:kind/:pubkey/:identifier" element={<EventPage />} />
      <Route path="/:nip19" element={<NIP19Page />} />

      {/* Protected routes - require login */}
      {isLoggedIn && (
        <Route element={showsProtectedPage ? <Outlet /> : <SignInLoading />}>
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
          <Route path="/settings/relays" element={<RelaysSettingsPage />} />
          {/* Test pages for debugging */}
          <Route path="/debug-video" element={<DebugVideoPage />} />
        </Route>
      )}

      {/* Community chat — the page itself login-gates via useChatSession so invite deep links survive */}
      <Route path="/chat" element={<Suspense fallback={null}><ChatPage /></Suspense>} />
      <Route path="/chat/invite" element={<Suspense fallback={null}><ChatPage /></Suspense>} />
      <Route path="/chat/:communityId" element={<Suspense fallback={null}><ChatPage /></Suspense>} />
      <Route path="/chat/:communityId/:channelId" element={<Suspense fallback={null}><ChatPage /></Suspense>} />
      <Route path="/chat/:communityId/:channelId/thread/:threadId" element={<Suspense fallback={null}><ChatPage /></Suspense>} />

      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </>
  );

  return (
    <ChatInviteProvider account={user?.pubkey}><BrowserRouter>
      <ScrollToTop />
      {/* AnalyticsUserTracker first: it configures the analytics identity that
          AnalyticsPageTracker's identity-linked events depend on. */}
      <AnalyticsUserTracker />
      <AnalyticsPageTracker />
      <Suspense fallback={null}>
      <Routes>
        {/* Marketing/informational pages - no app layout */}
        {/* /about redirects to about.divine.video via _redirects (301) */}
        <Route path="/authenticity" element={<AuthenticityPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/open-source" element={<OpenSourcePage />} />
        <Route path="/proofmode" element={<ProofModePage />} />
        <Route path="/human-created" element={<HumanCreatedPage />} />
        <Route path="/dmca" element={<DMCAPage />} />
        <Route path="/safety" element={<SafetyPage />} />
        <Route path="/family" element={<FamilyHubPage />} />
        <Route path="/family/talking-to-your-teen" element={<TalkingToYourTeenPage />} />
        <Route path="/family/media-plan" element={<MediaPlanPage />} />
        <Route path="/family/when-something-goes-wrong" element={<WhenSomethingGoesWrongPage />} />
        <Route path="/family/safety-tools" element={<SafetyToolsPage />} />
        <Route path="/age-review" element={<AgeReviewPage />} />
        <Route path="/kids" element={<KidsPolicyPage />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/exit" element={<PortabilityPage />} />
        <Route path="/exit/start" element={<ExitStartPage />} />
        <Route path="/account-portability" element={<Navigate to="/exit" replace />} />
        <Route path="/delete-account" element={<DeleteAccountPage />} />
        <Route path="/support" element={<Support />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/get-embed" element={<GetEmbedPage />} />
        <Route path="/app/callback" element={<AppCallbackPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/invite/:code"
          element={
            <InviteLinkRoute
              hasUser={Boolean(user)}
              isSessionResolving={isAuthPending}
            />
          }
        />

        {/* Dev-only brand primitives preview — tree-shaken in production */}
        {import.meta.env.DEV && BrandPreview && (
          <Route
            path="/__brand-preview"
            element={
              <Suspense fallback={null}>
                <BrandPreview />
              </Suspense>
            }
          />
        )}

        <Route element={<AppLayout />}>
          {/* Home/landing route - render profile directly on subdomain */}
          <Route path="/" element={subdomainUser ? <ProfilePage /> : <Index />} />
          {appShellRoutes}
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter></ChatInviteProvider>
  );
}
export default AppRouter;
