// ABOUTME: Feeds the active locale's direction to every Radix primitive
// ABOUTME: Without it they default to LTR and override the document's dir

import type { ReactNode } from 'react';
import { DirectionProvider } from '@radix-ui/react-direction';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, getLocaleDirection, normalizeLocale } from '@/lib/i18n/config';

/**
 * Radix primitives resolve their direction from this provider, and default to
 * `ltr` without it — then stamp that default onto their own markup. A
 * `TabsContent` carrying `dir="ltr"` overrides the `dir="rtl"` that
 * `applyDocumentLocale` puts on `<html>`, so every tab panel laid its content
 * out left-to-right in Arabic and Urdu, sponsorship disclosures included.
 *
 * Reads the same `normalizeLocale` → `getLocaleDirection` path that drives the
 * document attribute, so the two can never disagree about a locale.
 */
export function LocaleDirectionProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language) ?? DEFAULT_LOCALE;

  return <DirectionProvider dir={getLocaleDirection(locale)}>{children}</DirectionProvider>;
}
