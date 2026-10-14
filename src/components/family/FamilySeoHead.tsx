// ABOUTME: Client-side head tags for family routes, driven by the marketingSeo table
// ABOUTME: Covers SPA navigation; the SSG prerender bakes the same tags server-side

import { useHead } from "@unhead/react";

import type { MarketingSeoRoute } from "@/seo/marketingSeo";

export function FamilySeoHead({ seo }: { seo: MarketingSeoRoute }) {
  useHead({
    title: seo.title,
    link: [{ rel: "canonical", href: seo.canonical }],
    meta: [
      { name: "description", content: seo.description },
      { property: "og:type", content: seo.ogType },
      { property: "og:url", content: seo.canonical },
      { property: "og:title", content: seo.ogTitle },
      { property: "og:description", content: seo.ogDescription },
      { property: "og:image", content: seo.ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: seo.ogTitle },
      { name: "twitter:description", content: seo.ogDescription },
      { name: "twitter:image", content: seo.ogImage },
    ],
  });

  return null;
}
