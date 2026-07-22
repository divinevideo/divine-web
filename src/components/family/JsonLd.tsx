// ABOUTME: JSON-LD structured data components for family pages (Article, FAQPage, BreadcrumbList)
// ABOUTME: Rendered as inline scripts so the SSG prerender bakes them into served HTML

import { SITE_ORIGIN, type MarketingSeoRoute } from "@/seo/marketingSeo";

function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw JSON, not React-escaped text
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const PUBLISHER = {
  "@type": "Organization",
  name: "Divine",
  url: SITE_ORIGIN,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_ORIGIN}/app_icon.png`,
  },
};

const STIR_CITATIONS = [
  {
    "@type": "ScholarlyArticle",
    name: "Peer-reviewed research on youth online safety",
    url: "https://doi.org/10.3390/socsci14050302",
    author: [
      { "@type": "Person", name: "Dr. Pamela Wisniewski" },
      {
        "@type": "Organization",
        name: "Socio-Technical Interaction Research (STIR) Lab",
        url: "https://stirlab.org/",
      },
    ],
  },
];

export function ArticleJsonLd({
  seo,
  citeStirLab = false,
}: {
  seo: MarketingSeoRoute;
  citeStirLab?: boolean;
}) {
  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: seo.ogTitle,
        description: seo.description,
        image: seo.ogImage,
        url: seo.canonical,
        mainEntityOfPage: seo.canonical,
        datePublished: "2026-07-23",
        dateModified: "2026-07-23",
        author: PUBLISHER,
        publisher: PUBLISHER,
        ...(citeStirLab ? { citation: STIR_CITATIONS } : {}),
      }}
    />
  );
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export function FaqJsonLd({ entries }: { entries: FaqEntry[] }) {
  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: entries.map((e) => ({
          "@type": "Question",
          name: e.question,
          acceptedAnswer: { "@type": "Answer", text: e.answer },
        })),
      }}
    />
  );
}

export function BreadcrumbJsonLd({ seo }: { seo: MarketingSeoRoute }) {
  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Divine", item: SITE_ORIGIN },
          {
            "@type": "ListItem",
            position: 2,
            name: "For families",
            item: `${SITE_ORIGIN}/family`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: seo.breadcrumb,
            item: seo.canonical,
          },
        ],
      }}
    />
  );
}
