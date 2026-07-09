import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import { ProfileHeader } from './ProfileHeader';
import type { ProfileStats } from '@/lib/profileStats';
import { initializeI18n } from '@/lib/i18n';

vi.mock('./LinkedAccounts', () => ({
  LinkedAccounts: () => <div data-testid="linked-accounts" />,
}));

vi.mock('./ProfileBadges', () => ({
  ProfileBadges: () => null,
}));

vi.mock('./ReportContentDialog', () => ({
  ReportContentDialog: () => null,
}));

vi.mock('./UserListDialog', () => ({
  UserListDialog: () => null,
}));

vi.mock('@/hooks/useRssFeedAvailable', () => ({
  useRssFeedAvailable: () => false,
}));

// Mutable so protected-minor tests can flip the state (#176). Defaults preserve
// the prior behavior (non-protected, DMs off).
const pm = vi.hoisted(() => ({
  state: 'not_protected' as 'protected' | 'not_protected' | 'unknown',
  canUseDirectMessages: false,
  approved: new Set<string>(),
}));

vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => ({
    state: pm.state,
    isKnown: pm.state !== 'unknown',
    verifiedMinorAt: null,
  }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: pm.canUseDirectMessages }),
}));

vi.mock('@/lib/officialAccounts', async (orig) => ({
  ...(await orig<typeof import('@/lib/officialAccounts')>()),
  officialAccountsService: {
    isApprovedMinorDmRecipientSync: (pk: string) => pm.approved.has(pk),
    isApprovedMinorDmRecipient: async (pk: string) => pm.approved.has(pk),
    onVerdictChanged: () => () => {},
  },
}));

vi.mock('@/hooks/useFollowers', () => ({
  useFollowers: () => ({ data: undefined, isLoading: false, isFetchingNextPage: false, hasNextPage: false, fetchNextPage: vi.fn() }),
  getAllFollowerPubkeys: () => [],
}));

vi.mock('@/hooks/useFollowing', () => ({
  useFollowing: () => ({ data: { pubkeys: [] }, isLoading: false }),
}));

vi.mock('@/hooks/useBadges', () => ({
  useBadges: () => ({ data: [] }),
}));

vi.mock('@/hooks/useToast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/useNip05Validation', () => ({
  useNip05Validation: () => ({ state: 'valid' }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const baseStats: ProfileStats = {
  videosCount: 10,
  followersCount: 20,
  followingCount: 30,
  totalViews: 40,
  totalLoops: 50,
  totalReactions: 60,
  joinedDate: null,
  joinedDateLoading: false,
  isClassicViner: false,
  classicVineCount: 0,
  originalLoopCount: 0,
};

describe('ProfileHeader', () => {
  beforeEach(async () => {
    pm.state = 'not_protected';
    pm.canUseDirectMessages = false;
    pm.approved.clear();
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
  });

  describe('protected-minor Message affordance (#176)', () => {
    const HQ =
      'c4a39f1291291d452405cd8ddd798c4a29a3858c52cd0d843f1f6852cf17682e';
    const renderFor = (pubkey: string) =>
      render(
        <MemoryRouter>
          <ProfileHeader
            pubkey={pubkey}
            metadata={{ display_name: 'Someone' }}
            stats={baseStats}
            legacySocials={[]}
            isOwnProfile={false}
            isFollowing={false}
            onFollowToggle={vi.fn()}
          />
        </MemoryRouter>,
      );

    it('shows the Message button for a non-protected user', () => {
      pm.canUseDirectMessages = true;
      renderFor('a'.repeat(64));
      expect(
        screen.getByRole('button', { name: /message/i }),
      ).toBeInTheDocument();
    });

    it('hides the Message button when a protected minor views a non-approved profile', () => {
      pm.canUseDirectMessages = true;
      pm.state = 'protected'; // 'a'*64 is not in the approved set
      renderFor('a'.repeat(64));
      expect(
        screen.queryByRole('button', { name: /message/i }),
      ).not.toBeInTheDocument();
    });

    it('shows the Message button when a protected minor views an approved official profile', () => {
      pm.canUseDirectMessages = true;
      pm.state = 'protected';
      pm.approved.add(HQ);
      renderFor(HQ);
      expect(
        screen.getByRole('button', { name: /message/i }),
      ).toBeInTheDocument();
    });

    it('fails closed on unknown: hides the Message button for a non-approved profile', () => {
      pm.canUseDirectMessages = true;
      pm.state = 'unknown'; // 'a'*64 is not in the approved set
      renderFor('a'.repeat(64));
      expect(
        screen.queryByRole('button', { name: /message/i }),
      ).not.toBeInTheDocument();
    });

    it('keeps the Message button for an approved official while unknown', () => {
      pm.canUseDirectMessages = true;
      pm.state = 'unknown';
      pm.approved.add(HQ);
      renderFor(HQ);
      expect(
        screen.getByRole('button', { name: /message/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows clickable legacy socials for classic viners only', () => {
    render(
      <MemoryRouter>
        <ProfileHeader
          pubkey={'a'.repeat(64)}
          metadata={{ display_name: 'YouTube.com/ThomasSanders' }}
          stats={{
            ...baseStats,
            isClassicViner: true,
            classicVineCount: 398,
            originalLoopCount: 2300000000,
          }}
          legacySocials={[
            {
              platform: 'twitter',
              label: 'Twitter / X',
              handle: 'ThomasSanders',
              url: 'https://twitter.com/ThomasSanders',
            },
          ]}
          isOwnProfile={false}
          isFollowing={false}
          onFollowToggle={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /twitter \/ x/i })).toHaveAttribute(
      'href',
      'https://twitter.com/ThomasSanders'
    );
  });

  it('does not show legacy socials for modern profiles', () => {
    render(
      <MemoryRouter>
        <ProfileHeader
          pubkey={'a'.repeat(64)}
          metadata={{ display_name: 'Modern Creator' }}
          stats={baseStats}
          legacySocials={[
            {
              platform: 'twitter',
              label: 'Twitter / X',
              handle: 'ThomasSanders',
              url: 'https://twitter.com/ThomasSanders',
            },
          ]}
          isOwnProfile={false}
          isFollowing={false}
          onFollowToggle={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: /twitter \/ x/i })).not.toBeInTheDocument();
  });

  it('linkifies urls, hashtags, and nostr mentions in bio', () => {
    const mentionPubkey = 'b'.repeat(64);
    const npub = nip19.npubEncode(mentionPubkey);
    const about = `Loops forever: https://divine.video #Divine nostr:${npub}`;

    render(
      <MemoryRouter>
        <ProfileHeader
          pubkey={'a'.repeat(64)}
          metadata={{ display_name: 'Modern Creator', about }}
          stats={baseStats}
          isOwnProfile={false}
          isFollowing={false}
          onFollowToggle={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'https://divine.video' })).toHaveAttribute('href', 'https://divine.video/');
    expect(screen.getByRole('link', { name: '#Divine' })).toHaveAttribute('href', '/t/divine');
    expect(screen.getByRole('link', { name: `nostr:${npub}` })).toHaveAttribute('href', `/${npub}`);
  });

  it('normalizes website link and keeps row visible when non-empty', () => {
    render(
      <MemoryRouter>
        <ProfileHeader
          pubkey={'a'.repeat(64)}
          metadata={{ display_name: 'Modern Creator', website: 'divine.video/profile/alice' }}
          stats={baseStats}
          isOwnProfile={false}
          isFollowing={false}
          onFollowToggle={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /divine.video\/profile\/alice/i }))
      .toHaveAttribute('href', 'https://divine.video/profile/alice');
  });
});
