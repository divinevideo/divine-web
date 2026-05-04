import { ArrowSquareOut } from '@phosphor-icons/react';
import { useHead } from '@unhead/react';
import { Button } from '@/components/ui/button';
import { MERCH_STORE_URL } from '@/lib/externalLinks';
import merchProducts from '@/data/merchProducts.json';
import { cn } from '@/lib/utils';

const HEADLINE = 'Wear your loops.';
const BODY = "Tees, stickers, and stuff that doesn't take itself too seriously.";
const META_DESCRIPTION =
  "Tees, stickers, and stuff that doesn't take itself too seriously. Designed by Divine, printed and shipped by Bonfire.";
const STORE_CTA = 'Shop everything';
const TRUST = 'Designed by Divine. Printed and shipped by Bonfire.';

interface Product {
  name: string;
  url: string;
  image: string;
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
  return (
    <li className="list-none">
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'group block overflow-hidden rounded-[22px] border-2 border-brand-dark-green bg-brand-cream transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          ACCENT_SHADOW[accent],
        )}
      >
        <div className="aspect-square overflow-hidden bg-brand-off-white">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-brand-dark-green/60">
              {product.name}
            </div>
          )}
        </div>
        <div className="border-t-2 border-brand-dark-green px-4 py-3">
          <h2 className="text-base font-bold text-brand-dark-green">{product.name}</h2>
          {product.price ? (
            <p className="mt-1 text-sm text-brand-dark-green/70">{product.price}</p>
          ) : null}
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
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <section className="brand-card brand-offset-shadow-pink rounded-[22px] bg-brand-cream p-8 text-center md:p-14">
        <h1 className="font-extrabold tracking-tight text-brand-dark-green text-4xl md:text-6xl leading-[1.05]">
          {HEADLINE}
        </h1>
        <p className="mx-auto mt-4 max-w-prose text-base text-brand-dark-green/80 md:text-lg">
          {BODY}
        </p>
      </section>

      {PRODUCTS.length > 0 ? (
        <ul
          aria-label="Merch products"
          className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {PRODUCTS.map((product, idx) => (
            <ProductCard
              key={product.url}
              product={product}
              accent={ACCENTS[idx % ACCENTS.length]}
            />
          ))}
        </ul>
      ) : null}

      <div className="mt-12 flex flex-col items-center gap-3">
        <StoreCta />
        <p className="text-center text-sm text-muted-foreground">{TRUST}</p>
      </div>
    </div>
  );
}
