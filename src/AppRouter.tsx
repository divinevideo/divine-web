/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { lazy, Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { AnalyticsPageTracker } from "./components/AnalyticsPageTracker";
import { AnalyticsUserTracker } from "./components/AnalyticsUserTracker";
import { isShowcaseMode } from "./config/webMode";
import ShowcaseRoutes from "./routes/ShowcaseRoutes";

// The legacy client is a separate lazy chunk so showcase builds never download
// it. Splitting here rather than per-page means the entire app shell — feeds,
// profiles, login, messages — is behind one dynamic import that showcase mode
// simply never reaches.
const FullAppRoutes = lazy(() => import("./routes/FullAppRoutes"));

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnalyticsPageTracker />
      <AnalyticsUserTracker />
      {isShowcaseMode() ? (
        <ShowcaseRoutes />
      ) : (
        <Suspense fallback={null}>
          <FullAppRoutes />
        </Suspense>
      )}
    </BrowserRouter>
  );
}
export default AppRouter;
