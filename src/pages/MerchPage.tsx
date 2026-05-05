import { MarketingLayout } from '@/components/MarketingLayout';
import { Button } from '@/components/ui/button';
import { MERCH_STORE_URL } from '@/lib/externalLinks';

export function MerchPage() {
  return (
    <MarketingLayout>
      <main className="bg-brand-off-white text-brand-dark-green">
        <section className="container mx-auto max-w-3xl px-4 py-16 md:py-24">
          <div className="space-y-6">
            <p className="text-sm font-semibold text-primary">Divine store</p>
            <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-6xl">
              Divine merch
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-brand-dark-green/75">
              Shirts and other Divine gear live in our Bonfire store. It opens
              in a new tab so you can keep browsing Divine here.
            </p>
            <Button asChild variant="sticker" size="lg">
              <a href={MERCH_STORE_URL} target="_blank" rel="noopener noreferrer">
                Open merch store
              </a>
            </Button>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
