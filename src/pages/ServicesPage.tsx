// ABOUTME: Directory of companion Divine services (Space, Sounds, Badges, Crossposter, Verifier, Status)
// ABOUTME: Renders branded cards from src/config/divineServices.ts

import { ArrowSquareOut } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import { MarketingLayout } from '@/components/MarketingLayout';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { Card, type CardAccent } from '@/components/ui/card';
import { DIVINE_SERVICES } from '@/config/divineServices';

const CARD_ACCENTS: CardAccent[] = [
  'green',
  'pink',
  'violet',
  'orange',
  'yellow',
  'blue',
];

export function ServicesPage() {
  const { t } = useTranslation();

  return (
    <MarketingLayout>
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <SectionHeader as="h2">{t('servicesPage.title')}</SectionHeader>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          {t('servicesPage.intro')}
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DIVINE_SERVICES.map((service, index) => {
            const ServiceIcon = service.icon;
            return (
              <a
                key={service.id}
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
                aria-label={t('servicesPage.openService', { name: service.name })}
              >
                <Card
                  variant="brand"
                  accent={CARD_ACCENTS[index % CARD_ACCENTS.length]}
                  className="flex h-full flex-col gap-3 p-5 transition-transform group-hover:-translate-y-1"
                >
                  <div className="flex items-center gap-3">
                    <ServiceIcon className="h-7 w-7" />
                    <h3 className="text-lg font-semibold text-foreground">
                      {service.name}
                    </h3>
                    <ArrowSquareOut className="ml-auto h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(`servicesPage.items.${service.id}`)}
                  </p>
                </Card>
              </a>
            );
          })}
        </div>
      </div>
    </MarketingLayout>
  );
}

export default ServicesPage;
