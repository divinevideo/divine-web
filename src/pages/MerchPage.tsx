import { ArrowSquareOut } from '@phosphor-icons/react';
import { useHead } from '@unhead/react';
import { Button } from '@/components/ui/button';
import { MERCH_STORE_URL } from '@/lib/externalLinks';
import merchProducts from '@/data/merchProducts.json';
import { cn } from '@/lib/utils';

const HEADLINE = 'Wear your loops.';
const BODY = "Tees, hoodies, hats, and stuff that doesn't take itself too seriously.";
const META_DESCRIPTION =
  "Tees, hoodies, hats, and stuff that doesn't take itself too seriously. Designed by Divine, printed and shipped by Bonfire.";
const STORE_CTA = 'Shop everything';
const TRUST = 'Designed by Divine. Printed and shipped by Bonfire.';

interface Product {
  name: string;
  url: string;
  image: string;
  campaign?: string;
  campaignTitle?: string;
  price?: string;
}

const PRODUCTS: Product[] = merchProducts.products;

const ACCENTS = ['pink', 'green', 'violet', 'yellow', 'orange', 'blue'] as const;
const ACCENT_SHADOW: Record<(typeof ACCENTS)[number], string> = {
  pink: 'brand-offset-shadow-pink',
  green: 'brand-offset-shadow-green',
  violet: 'brand-offset-shadow-violet',
  yellow: 'brand-offset-shadow-yellow',
  orange: 'brand-offset-shadow-orange',
  blue: 'brand-offset-shadow-blue',
};

function StoreCta({ className, label = STORE_CTA }: { className?: string; label?: string }) {
  return (
    <Button asChild variant="sticker" size="lg" className={cn('text-base', className)}>
      <a href={MERCH_STORE_URL} target="_blank" rel="noopener noreferrer">
        {label}
        <ArrowSquareOut className="ml-2 h-5 w-5" weight="bold" />
      </a>
    </Button>
  );
}

function ProductCard({ product, accent }: { product: Product; accent: (typeof ACCENTS)[number] }) {
  // When a campaign has multiple variants, show the campaign as a small
  // overline above the variant name. Single-variant campaigns repeat the
  // name in both fields, so we hide the overline to avoid duplication.
  const showCampaignOverline =
    product.campaignTitle && product.campaignTitle !== product.name;

  return (
    <li className="list-none">
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${product.name} on Bonfire`}
        className={cn(
          'group flex h-full flex-col overflow-hidden rounded-[22px] border-2 border-brand-dark-green bg-brand-off-white transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          ACCENT_SHADOW[accent],
        )}
      >
        <div className="aspect-square overflow-hidden bg-white">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 border-t-2 border-brand-dark-green bg-brand-off-white px-5 py-4 text-brand-dark-green">
          {showCampaignOverline ? (
            <p className="text-xs font-semibold tracking-wide text-brand-dark-green/60">
              {product.campaignTitle}
            </p>
          ) : null}
          <h2 className="text-lg font-extrabold leading-tight text-brand-dark-green">
            {product.name}
          </h2>
          <p className="mt-auto pt-2 text-sm font-semibold text-brand-dark-green inline-flex items-center gap-1">
            Shop on Bonfire
            <ArrowSquareOut className="h-4 w-4" weight="bold" />
          </p>
        </div>
      </a>
    </li>
  );
}

export default function MerchPage() {
  useHead({
    title: 'Merch — Divine',
    meta: [
      { name: 'description', content: META_DESCRIPTION },
      { property: 'og:title', content: 'Divine Merch' },
      { property: 'og:description', content: META_DESCRIPTION },
      { property: 'og:url', content: 'https://divine.video/merch' },
      { property: 'og:image', content: 'https://divine.video/og.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Divine Merch' },
      { name: 'twitter:description', content: META_DESCRIPTION },
    ],
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
      <section className="brand-card brand-offset-shadow-pink rounded-[22px] bg-brand-off-white p-8 text-center md:p-14">
        <h1 className="font-extrabold tracking-tight text-brand-dark-green text-4xl md:text-6xl leading-[1.05]">
          {HEADLINE}
        </h1>
        <p className="mx-auto mt-4 max-w-prose text-base text-brand-dark-green/80 md:text-lg">
          {BODY}
        </p>
        <div className="mt-8 flex justify-center">
          <StoreCta />
        </div>
      </section>

      {PRODUCTS.length > 0 ? (
        <ul
          aria-label="Merch products"
          className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {PRODUCTS.map((product, idx) => (
            <ProductCard
              key={`${product.campaign ?? ''}:${product.name}`}
              product={product}
              accent={ACCENTS[idx % ACCENTS.length]}
            />
          ))}
        </ul>
      ) : null}

      <div className="mt-14 flex flex-col items-center gap-4 rounded-[22px] border-2 border-brand-green/40 bg-brand-off-white/10 p-6 text-center">
        <StoreCta />
        <p className="text-sm font-medium text-brand-off-white">{TRUST}</p>
      </div>
    </div>
  );
}
