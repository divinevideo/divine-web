/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ABOUTME: Route table for the informational pages, shared by showcase and full mode
// ABOUTME: These pages render their own MarketingLayout, so they never need the app shell

import { Route } from "react-router-dom";

import PrivacyPage from "@/pages/PrivacyPage";
import OpenSourcePage from "@/pages/OpenSourcePage";
import ProofModePage from "@/pages/ProofModePage";
import AuthenticityPage from "@/pages/AuthenticityPage";
import DMCAPage from "@/pages/DMCAPage";
import HumanCreatedPage from "@/pages/HumanCreatedPage";
import { SafetyPage } from "@/pages/SafetyPage";
import { FamilyHubPage } from "@/pages/family/FamilyHubPage";
import { TalkingToYourTeenPage } from "@/pages/family/TalkingToYourTeenPage";
import { MediaPlanPage } from "@/pages/family/MediaPlanPage";
import { WhenSomethingGoesWrongPage } from "@/pages/family/WhenSomethingGoesWrongPage";
import { SafetyToolsPage } from "@/pages/family/SafetyToolsPage";
import { AgeReviewPage } from "@/pages/AgeReviewPage";
import { KidsPolicyPage } from "@/pages/KidsPolicyPage";
import { Support } from "@/pages/Support";
import { FAQPage } from "@/pages/FAQPage";
import { TermsPage } from "@/pages/TermsPage";

/**
 * Informational pages available in every mode.
 *
 * Returned as a fragment of <Route> elements so both route tables can splice
 * them in without duplicating the list. /about and /faq also have 301s in
 * public/_redirects that take precedence at the edge.
 */
export function documentRoutes() {
  return (
    <>
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
      <Route path="/support" element={<Support />} />
      <Route path="/faq" element={<FAQPage />} />
    </>
  );
}
