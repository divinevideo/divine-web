/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ABOUTME: Dev-only routes shared by every web mode
// ABOUTME: The lazy() call sits behind import.meta.env.DEV so production drops the chunk

import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";

// Dev-only: static preview surface for the brand system. The `lazy()` call
// sits behind `import.meta.env.DEV` so Vite's dead-code elimination drops both
// the route registration AND the async chunk reference from production builds.
const BrandPreview = import.meta.env.DEV
  ? lazy(() => import("@/pages/_BrandPreview"))
  : null;

/**
 * Routes that exist only in development.
 *
 * Registered in both showcase and full mode — the brand preview documents the
 * design system itself, so it must not disappear just because the public site
 * is running in showcase mode. The visual and a11y suites depend on it.
 */
export function devRoutes() {
  if (!import.meta.env.DEV || !BrandPreview) return null;

  return (
    <Route
      path="/__brand-preview"
      element={
        <Suspense fallback={null}>
          <BrandPreview />
        </Suspense>
      }
    />
  );
}
