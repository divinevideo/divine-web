// ABOUTME: Guards that every Radix dialog reachable from feed/category surfaces has an
// ABOUTME: accessible description (no "Missing `Description`" console warning in prod)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoCommentsModal } from '@/components/VideoCommentsModal';
import { VideoReactionsModal } from '@/components/VideoReactionsModal';
import { BadgeDetailModal } from '@/components/BadgeDetailModal';
import { CommandDialog, CommandInput } from '@/components/ui/command';
import { SidebarProvider, Sidebar, SidebarTrigger } from '@/components/ui/sidebar';
import type { ParsedVideoData } from '@/types/video';
import type { ValidatedBadge } from '@/lib/badges';
import type { NostrEvent } from '@nostrify/nostrify';
import { initializeI18n } from '@/lib/i18n';

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => true,
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: {
      metadata: {
        name: 'Badge Issuer',
        picture: 'https://media.divine.video/issuer.png',
      },
    },
  }),
}));

vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: () => undefined,
}));

const PUBKEY = 'a'.repeat(64);

const video: ParsedVideoData = {
  id: 'b'.repeat(64),
  pubkey: PUBKEY,
  kind: 34236,
  createdAt: 1700000000,
  content: 'A test video',
  videoUrl: 'https://media.divine.video/test.mp4',
  title: 'Test video',
  hashtags: ['comedy'],
  vineId: 'test-vine-id',
  isVineMigrated: false,
  reposts: [],
};

const awardEvent: NostrEvent = {
  id: 'c'.repeat(64),
  pubkey: PUBKEY,
  created_at: 1700000000,
  kind: 8,
  tags: [],
  content: '',
  sig: 'd'.repeat(128),
};

const definitionEvent: NostrEvent = {
  id: 'e'.repeat(64),
  pubkey: PUBKEY,
  created_at: 1700000000,
  kind: 30009,
  tags: [['d', 'test-badge']],
  content: '',
  sig: 'f'.repeat(128),
};

const badge: ValidatedBadge = {
  definition: {
    dTag: 'test-badge',
    name: 'Test Badge',
    description: 'A badge for testing',
    image: 'https://media.divine.video/badge.png',
    thumbs: {},
    issuerPubkey: PUBKEY,
    naddr: `30009:${PUBKEY}:test-badge`,
    isOfficial: false,
    event: definitionEvent,
  },
  awardEvent,
  awardedAt: 1700000000,
};

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  const storage = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
  });
  await initializeI18n({ force: true, languages: ['en-US'] });
  fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Unexpected network call'));
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

function expectNoRadixDescriptionWarning() {
  const allCalls = [...warnSpy.mock.calls, ...errorSpy.mock.calls];
  const radixWarnings = allCalls.filter((args) =>
    args.some(
      (arg) => typeof arg === 'string' && arg.includes('Missing `Description`')
    )
  );
  expect(radixWarnings).toEqual([]);
}

async function expectDescribedDialog() {
  const dialog = await screen.findByRole('dialog');
  const describedBy = dialog.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  const description = document.getElementById(describedBy!);
  expect(description).not.toBeNull();
  expect(description!.textContent!.trim()).not.toBe('');
  expectNoRadixDescriptionWarning();
}

describe('dialog descriptions (a11y)', () => {
  it('VideoCommentsModal renders with an accessible description', async () => {
    render(
      <VideoCommentsModal
        video={video}
        open={true}
        onOpenChange={() => {}}
        isLoadingComments={true}
      />
    );
    await expectDescribedDialog();
  });

  it('VideoReactionsModal renders with an accessible description', async () => {
    render(
      <VideoReactionsModal
        open={true}
        onOpenChange={() => {}}
        reactions={{ likes: [], reposts: [] }}
        type="likes"
      />
    );
    await expectDescribedDialog();
  });

  it('BadgeDetailModal renders with an accessible description', async () => {
    render(
      <BadgeDetailModal badge={badge} open={true} onOpenChange={() => {}} />
    );
    await expectDescribedDialog();
  });

  it('CommandDialog renders with an accessible description', async () => {
    render(
      <CommandDialog open={true}>
        <CommandInput placeholder="Search..." />
      </CommandDialog>
    );
    await expectDescribedDialog();
  });

  it('mobile Sidebar sheet renders with an accessible description', async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <Sidebar>
          <div>Sidebar content</div>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    );

    await user.click(screen.getByRole('button', { name: /sidebar/i }));

    await waitFor(async () => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });
    await expectDescribedDialog();
  });
});
