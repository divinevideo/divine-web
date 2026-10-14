# Divine Services Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/services` directory page listing Divine's six public companion services, linked from the sidebar's top-level nav and footer links, prerendered for SEO.

**Architecture:** A typed config module (`src/config/divineServices.ts`) is the single source for the service list. `ServicesPage` renders it with brand primitives (`SectionHeader`, `Card variant="brand"`), the sidebar links to the internal route, and `scripts/prerender-legal.mjs` emits a static HTML version from a content partial. Spec: `docs/superpowers/specs/2026-07-27-divine-services-directory-design.md`.

**Tech Stack:** React 18, TypeScript, React Router 6, react-i18next, Phosphor Icons, Vitest, Testing Library.

## Global Constraints

- Brand hard rules (CI-enforced): no Tailwind `uppercase` class, no gradients on layout surfaces, no `lucide-react` imports (Phosphor only).
- Copy stays casual-direct per brand voice; service names are proper nouns and are never translated.
- All 16 locales under `src/lib/i18n/locales/` must keep identical key sets; non-English locales get the English strings as placeholders.
- External service links use `target="_blank" rel="noopener noreferrer"`.
- Work happens on branch `feat/divine-services-directory` (worktree `.worktrees/divine-services-directory`).

---

### Task 1: Add the services config module

**Files:**

- Create: `src/config/divineServices.ts`
- Create: `src/config/divineServices.test.ts`

**Interfaces:**

- Produces: `DIVINE_SERVICES: DivineService[]` where
  `DivineService { id: DivineServiceId; name: string; url: string; icon: Icon }`
  and `DivineServiceId = 'space' | 'sounds' | 'badges' | 'crossposter' | 'verifier' | 'status'`.
  Consumed by `ServicesPage` (Task 3) and the prerender guard test (Task 5).

- [ ] **Step 1: Write the failing config test**

Create `src/config/divineServices.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { DIVINE_SERVICES } from './divineServices';

describe('DIVINE_SERVICES', () => {
  it('lists each service with a unique id, name, https URL, and icon', () => {
    const ids = DIVINE_SERVICES.map((service) => service.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const service of DIVINE_SERVICES) {
      expect(service.name.length).toBeGreaterThan(0);
      expect(service.url).toMatch(/^https:\/\//);
      expect(service.icon).toBeTruthy();
    }
  });

  it('includes the six launch services in display order', () => {
    expect(DIVINE_SERVICES.map((service) => service.id)).toEqual([
      'space',
      'sounds',
      'badges',
      'crossposter',
      'verifier',
      'status',
    ]);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/config/divineServices.test.ts
```

Expected: FAIL because `./divineServices` does not exist.

- [ ] **Step 3: Implement the config module**

Create `src/config/divineServices.ts`:

```ts
// ABOUTME: Canonical list of public companion Divine services shown on /services
// ABOUTME: Add future public services here; the page and prerender guard render from it

import {
  HouseLine,
  Medal,
  MusicNotes,
  Pulse,
  SealCheck,
  ShareNetwork,
  type Icon,
} from '@phosphor-icons/react';

export type DivineServiceId =
  | 'space'
  | 'sounds'
  | 'badges'
  | 'crossposter'
  | 'verifier'
  | 'status';

export interface DivineService {
  id: DivineServiceId;
  name: string;
  url: string;
  icon: Icon;
}

export const DIVINE_SERVICES: DivineService[] = [
  {
    id: 'space',
    name: 'Divine Space',
    url: 'https://divine.space',
    icon: HouseLine,
  },
  {
    id: 'sounds',
    name: 'Sounds',
    url: 'https://sounds.divine.video',
    icon: MusicNotes,
  },
  {
    id: 'badges',
    name: 'Badges',
    url: 'https://badges.divine.video',
    icon: Medal,
  },
  {
    id: 'crossposter',
    name: 'Crossposter',
    url: 'https://crossposter.divine.video',
    icon: ShareNetwork,
  },
  {
    id: 'verifier',
    name: 'Verifier',
    url: 'https://inquisitor.divine.video',
    icon: SealCheck,
  },
  {
    id: 'status',
    name: 'Status',
    url: 'https://status.divine.video',
    icon: Pulse,
  },
];
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
npx vitest run src/config/divineServices.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the config module**

```bash
git add src/config/divineServices.ts src/config/divineServices.test.ts
git commit -m "feat: add Divine services config"
```

### Task 2: Add the i18n keys in all 16 locales

**Files:**

- Modify: `src/lib/i18n/locales/en/common.json`
- Modify: the other 15 locale files under `src/lib/i18n/locales/*/common.json`

**Interfaces:**

- Produces: `nav.services`, `servicesPage.title`, `servicesPage.intro`,
  `servicesPage.openService` (interpolation `{{name}}`), and
  `servicesPage.items.<id>` for every `DivineServiceId` from Task 1.
  Consumed by `ServicesPage` (Task 3) and `AppSidebar` (Task 4).

- [ ] **Step 1: Add the keys with a script**

Run:

```bash
python3 - <<'EOF'
import json, glob, collections

EN = {
    'nav_services': 'Services',
    'title': 'Divine services',
    'intro': 'Divine is more than loops. These services help you make the most of it.',
    'openService': 'Open {{name}}',
    'items': {
        'space': 'Your profile, your rules. Themes, Top 8, profile music.',
        'sounds': 'Trending sounds and a Creative Commons library for your loops.',
        'badges': 'Awards for creators who show up.',
        'crossposter': 'Post your loops to the other platforms — only when you opt in.',
        'verifier': 'Check where a video really came from.',
        'status': 'Is it us or is it you? Check here.',
    },
}

for path in sorted(glob.glob('src/lib/i18n/locales/*/common.json')):
    with open(path) as f:
        data = json.load(f, object_pairs_hook=collections.OrderedDict)

    # nav.services after nav.popular (or appended if ordering differs)
    nav = data['nav']
    new_nav = collections.OrderedDict()
    inserted = False
    for key, value in nav.items():
        new_nav[key] = value
        if key == 'popular':
            new_nav['services'] = EN['nav_services']
            inserted = True
    if not inserted:
        new_nav['services'] = EN['nav_services']
    data['nav'] = new_nav

    services_page = collections.OrderedDict()
    services_page['title'] = EN['title']
    services_page['intro'] = EN['intro']
    services_page['openService'] = EN['openService']
    services_page['items'] = collections.OrderedDict(EN['items'])

    new_data = collections.OrderedDict()
    placed = False
    for key, value in data.items():
        new_data[key] = value
        if key == 'support':
            new_data['servicesPage'] = services_page
            placed = True
    if not placed:
        new_data['servicesPage'] = services_page

    with open(path, 'w') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('updated', path)
EOF
```

English strings are used in every locale as placeholders; translators catch up
later (established pattern for new keys).

- [ ] **Step 2: Verify key parity and English values**

Run:

```bash
python3 - <<'EOF'
import json, glob

def flat(d, prefix=''):
    for key, value in d.items():
        full = f'{prefix}.{key}' if prefix else key
        if isinstance(value, dict):
            yield from flat(value, full)
        else:
            yield full

reference = set(flat(json.load(open('src/lib/i18n/locales/en/common.json'))))
for path in sorted(glob.glob('src/lib/i18n/locales/*/common.json')):
    keys = set(flat(json.load(open(path))))
    assert keys == reference, f'{path} parity mismatch: {keys ^ reference}'
print('all 16 locales have identical key sets')
EOF
```

Expected: prints `all 16 locales have identical key sets`.

- [ ] **Step 3: Commit the locale keys**

```bash
git add src/lib/i18n/locales/
git commit -m "feat: add services directory locale keys"
```

### Task 3: Build the services page and register the route

**Files:**

- Create: `src/pages/ServicesPage.tsx`
- Create: `src/pages/ServicesPage.test.tsx`
- Modify: `src/AppRouter.tsx` (import list near line 52, marketing route block near line 169)

**Interfaces:**

- Consumes: `DIVINE_SERVICES` (Task 1); `servicesPage.*` keys (Task 2);
  `SectionHeader` from `@/components/brand/SectionHeader` (`as="h2"`, children);
  `Card` + `CardAccent` from `@/components/ui/card` (`variant="brand"`, `accent`);
  `MarketingLayout` from `@/components/MarketingLayout`.
- Produces: default + named export `ServicesPage`; route `/services`.

- [ ] **Step 1: Write the failing page test**

Create `src/pages/ServicesPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeI18n } from '@/lib/i18n';
import { DIVINE_SERVICES } from '@/config/divineServices';
import ServicesPage from './ServicesPage';

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marketing-layout">{children}</div>
  ),
}));

describe('ServicesPage', () => {
  beforeEach(async () => {
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('renders the title and intro copy', () => {
    render(
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Divine services' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/more than loops/i)).toBeInTheDocument();
  });

  it('links every configured service to its URL in a new tab', () => {
    render(
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>,
    );

    for (const service of DIVINE_SERVICES) {
      const link = screen.getByRole('link', { name: `Open ${service.name}` });
      expect(link).toHaveAttribute('href', service.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    }
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/pages/ServicesPage.test.tsx
```

Expected: FAIL because `./ServicesPage` does not exist.

- [ ] **Step 3: Implement the page**

Create `src/pages/ServicesPage.tsx`:

```tsx
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
```

- [ ] **Step 4: Register the route**

In `src/AppRouter.tsx`, add to the page imports (near the `FAQPage` import at
line 52):

```tsx
import { ServicesPage } from "./pages/ServicesPage";
```

Add to the marketing route block (near the `/faq` route at line 169):

```tsx
<Route path="/services" element={<ServicesPage />} />
```

- [ ] **Step 5: Run the test and verify GREEN**

Run:

```bash
npx vitest run src/pages/ServicesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the page and route**

```bash
git add src/pages/ServicesPage.tsx src/pages/ServicesPage.test.tsx src/AppRouter.tsx
git commit -m "feat: add services directory page"
```

### Task 4: Link the directory from the sidebar

**Files:**

- Modify: `src/components/AppSidebar.tsx` (nav cluster near line 202, footer Divine links near line 458)
- Modify: `src/components/AppSidebar.test.tsx`

**Interfaces:**

- Consumes: `nav.services` key (Task 2); Phosphor `SquaresFour` icon;
  existing `NavItem` (`icon`, `label`, `onClick`, `isActive`) and `isActive(path)` helper.
- Produces: top-level "Services" nav item after Popular; footer "Services"
  router link in the Divine-links collapsible.

- [ ] **Step 1: Write the failing sidebar tests**

Add to the existing `describe('AppSidebar', ...)` block in
`src/components/AppSidebar.test.tsx`:

```tsx
it('navigates to the services directory from the top-level nav', () => {
  render(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Services' }));
  expect(mockNavigate).toHaveBeenCalledWith('/services');
});

it('links to the services directory from the footer Divine links', async () => {
  render(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: /about divine/i }));

  const link = await screen.findByRole('link', { name: 'Services' });
  expect(link).toHaveAttribute('href', '/services');
});
```

The collapsible trigger's accessible name is the English `footer.aboutDivine`
value, "About Divine" (verified in `src/lib/i18n/locales/en/common.json`).

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npx vitest run src/components/AppSidebar.test.tsx
```

Expected: FAIL because no Services nav item or footer link exists.

- [ ] **Step 3: Add the nav item and footer link**

In `src/components/AppSidebar.tsx`:

1. Add `SquaresFour` to the existing `@phosphor-icons/react` import list.
2. Immediately after the Popular `NavItem` block (the one navigating to
   `/popular`), add:

```tsx
<NavItem
  icon={<SquaresFour className="h-[18px] w-[18px]" weight={isActive('/services') ? 'fill' : 'bold'} />}
  label={t('nav.services')}
  onClick={() => navigate('/services')}
  isActive={isActive('/services')}
/>
```

3. In the footer Divine-links collapsible, immediately before the existing
   `/merch` router `Link`, add:

```tsx
<Link
  to="/services"
  className="transition-colors hover:text-primary"
>
  {t('nav.services')}
</Link>
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
npx vitest run src/components/AppSidebar.test.tsx
```

Expected: PASS, including the two new tests.

- [ ] **Step 5: Commit the sidebar links**

```bash
git add src/components/AppSidebar.tsx src/components/AppSidebar.test.tsx
git commit -m "feat: link services directory from sidebar"
```

### Task 5: Prerender the directory for SEO

**Files:**

- Create: `scripts/prerender-content/services-content.html`
- Modify: `scripts/prerender-legal.mjs` (`PAGES` array near line 179)
- Create: `tests/divine-services-directory.test.ts`

**Interfaces:**

- Consumes: `DIVINE_SERVICES` (Task 1); the `PAGES` `contentFile` mechanism in
  `scripts/prerender-legal.mjs` (same as `faq-content.html`).
- Produces: prerendered `dist/services/index.html` at build time; guard test
  keeping the static partial in sync with the config.

- [ ] **Step 1: Write the failing guard test**

Create `tests/divine-services-directory.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DIVINE_SERVICES } from '../src/config/divineServices';

const REPO_ROOT = resolve(__dirname, '..');

describe('divine services prerender content', () => {
  it('mentions every configured service name and URL', () => {
    const html = readFileSync(
      resolve(REPO_ROOT, 'scripts/prerender-content/services-content.html'),
      'utf8',
    );

    for (const service of DIVINE_SERVICES) {
      expect(html).toContain(service.url);
      expect(html).toContain(service.name);
    }
  });

  it('registers the /services page in the prerender script', () => {
    const script = readFileSync(
      resolve(REPO_ROOT, 'scripts/prerender-legal.mjs'),
      'utf8',
    );

    expect(script).toContain("path: '/services'");
    expect(script).toContain('services-content.html');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run tests/divine-services-directory.test.ts
```

Expected: FAIL because the content partial does not exist.

- [ ] **Step 3: Add the content partial**

Create `scripts/prerender-content/services-content.html`:

```html
<section>
  <h1>Divine services</h1>
  <p>Divine is more than loops. These services help you make the most of it.</p>
  <ul>
    <li>
      <a href="https://divine.space" rel="noopener noreferrer">Divine Space</a>
      — Your profile, your rules. Themes, Top 8, profile music.
    </li>
    <li>
      <a href="https://sounds.divine.video" rel="noopener noreferrer">Sounds</a>
      — Trending sounds and a Creative Commons library for your loops.
    </li>
    <li>
      <a href="https://badges.divine.video" rel="noopener noreferrer">Badges</a>
      — Awards for creators who show up.
    </li>
    <li>
      <a href="https://crossposter.divine.video" rel="noopener noreferrer">Crossposter</a>
      — Post your loops to the other platforms, only when you opt in.
    </li>
    <li>
      <a href="https://inquisitor.divine.video" rel="noopener noreferrer">Verifier</a>
      — Check where a video really came from.
    </li>
    <li>
      <a href="https://status.divine.video" rel="noopener noreferrer">Status</a>
      — Is it us or is it you? Check here.
    </li>
  </ul>
</section>
```

- [ ] **Step 4: Register the page in the prerender script**

In `scripts/prerender-legal.mjs`, add to the `PAGES` array immediately after
the `/faq` entry:

```js
{
  path: '/services',
  title: 'Divine Services',
  description: 'Companion services that help you make the most of Divine: Space, Sounds, Badges, Crossposter, Verifier, and Status.',
  contentFile: 'services-content.html',
},
```

- [ ] **Step 5: Run the guard test and verify GREEN**

Run:

```bash
npx vitest run tests/divine-services-directory.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify the build emits the prerendered page**

Run:

```bash
npm run build
ls dist/services/index.html
```

Expected: build succeeds and `dist/services/index.html` exists.

- [ ] **Step 7: Commit the prerender support**

```bash
git add scripts/prerender-content/services-content.html scripts/prerender-legal.mjs tests/divine-services-directory.test.ts
git commit -m "feat: prerender services directory"
```

### Task 6: Verify the complete feature

**Files:**

- Verify only; do not change unrelated files.

- [ ] **Step 1: Run all focused tests**

```bash
npx vitest run \
  src/config/divineServices.test.ts \
  src/pages/ServicesPage.test.tsx \
  src/components/AppSidebar.test.tsx \
  src/pages/static-pages-i18n.test.tsx \
  tests/divine-services-directory.test.ts \
  tests/brand/no-uppercase-class.test.ts \
  tests/brand/no-gradients.test.ts \
  tests/brand/no-lucide-react.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Run the full project gate**

```bash
npm run test
```

Expected: TypeScript, ESLint, all Vitest tests, and the production build PASS.

- [ ] **Step 3: Browser verification**

```bash
npm run dev
```

At desktop and mobile widths:

1. `/services` renders the title, intro, and six branded cards.
2. Each card opens the correct service in a new tab.
3. Sidebar top-level "Services" item navigates to `/services` and shows the
   active state there.
4. Footer "About Divine" expandable contains a working Services link.

Stop the dev server after verification.

- [ ] **Step 4: Inspect the final diff and worktree**

```bash
git diff --check origin/main
git status --short
git log --oneline origin/main..HEAD
```

Expected: no whitespace errors; clean worktree; seven commits (one spec doc,
six implementation).
