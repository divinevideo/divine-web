// ABOUTME: SSR entry for build-time prerendering of marketing (family) routes
// ABOUTME: Loaded via vite.ssrLoadModule by scripts/prerender-marketing.mjs; not part of the client bundle

import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { IconContext } from "@phosphor-icons/react";
import { I18nextProvider } from "react-i18next";
import { createHead, UnheadProvider } from "@unhead/react/server";

import { createI18nInstance } from "@/lib/i18n";
import { getFamilySeo, type MarketingSeoRoute } from "@/seo/marketingSeo";
import { FamilyHubPage } from "@/pages/family/FamilyHubPage";
import { TalkingToYourTeenPage } from "@/pages/family/TalkingToYourTeenPage";
import { MediaPlanPage } from "@/pages/family/MediaPlanPage";
import { WhenSomethingGoesWrongPage } from "@/pages/family/WhenSomethingGoesWrongPage";
import { SafetyToolsPage } from "@/pages/family/SafetyToolsPage";

const ROUTE_COMPONENTS: Record<string, ComponentType> = {
  "/family": FamilyHubPage,
  "/family/talking-to-your-teen": TalkingToYourTeenPage,
  "/family/media-plan": MediaPlanPage,
  "/family/when-something-goes-wrong": WhenSomethingGoesWrongPage,
  "/family/safety-tools": SafetyToolsPage,
};

export const MARKETING_SSG_ROUTES = Object.keys(ROUTE_COMPONENTS);

export interface RenderedMarketingRoute {
  appHtml: string;
  seo: MarketingSeoRoute;
}

export async function renderMarketingRoute(
  path: string
): Promise<RenderedMarketingRoute> {
  const Page = ROUTE_COMPONENTS[path];
  const seo = getFamilySeo(path);
  if (!Page || !seo) {
    throw new Error(`No prerender component or SEO data for route: ${path}`);
  }

  const i18n = await createI18nInstance({ languages: ["en"] });
  // Head collected but discarded: the prerender script bakes meta tags from marketingSeo directly
  const head = createHead();

  const appHtml = renderToString(
    <I18nextProvider i18n={i18n}>
      <UnheadProvider value={head}>
        <StaticRouter location={path}>
          <IconContext.Provider value={{ weight: "bold", mirrored: false }}>
            <Page />
          </IconContext.Provider>
        </StaticRouter>
      </UnheadProvider>
    </I18nextProvider>
  );

  return { appHtml, seo };
}
