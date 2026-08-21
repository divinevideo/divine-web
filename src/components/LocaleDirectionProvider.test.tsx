import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import { LocaleDirectionProvider } from './LocaleDirectionProvider';

function renderTabs() {
  return render(
    <LocaleDirectionProvider>
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
        <TabsContent value="one">
          <span data-testid="panel-child">content</span>
        </TabsContent>
      </Tabs>
    </LocaleDirectionProvider>,
  );
}

// Radix writes `dir` on the Tabs root rather than on the panel, and the panel
// inherits it. Asserting on whichever ancestor actually carries the attribute
// keeps this pinned to the rendered direction rather than to Radix's current
// choice of which node to stamp.
function directedAncestor(): HTMLElement {
  return screen.getByTestId('panel-child').closest('[dir]') as HTMLElement;
}

describe('LocaleDirectionProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // Without a DirectionProvider, Radix falls back to `ltr` and stamps that on
  // its own markup, overriding the `dir="rtl"` applyDocumentLocale puts on
  // <html> — so every tab panel laid out left-to-right in Arabic and Urdu.
  // Removing the provider turns both of these red.
  it.each(['ar', 'ur'])('gives Radix the document direction in %s', async (locale) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    await initializeI18n({ force: true, languages: [locale] });

    renderTabs();

    expect(directedAncestor()).toHaveAttribute('dir', 'rtl');
  });

  it('leaves left-to-right locales exactly as they were', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    await initializeI18n({ force: true, languages: ['en'] });

    renderTabs();

    expect(directedAncestor()).toHaveAttribute('dir', 'ltr');
  });
});
