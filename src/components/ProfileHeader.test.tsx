vi.mock('@/components/SupporterRecognition', () => ({ OwnSupporterRecognition: () => null, PublicSupporterRecognition: () => null }));
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import { ProfileHeader } from './ProfileHeader';
import { DIVINE_SUPPORT_PUBKEY } from '@/lib/dm';
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
  nip05State: 'valid',
  approved: new Set<string>(),
  blocked: new Set<string>(),
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
  useFollowing: () => ({
    data: undefined,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }),
  getAllFollowingPubkeys: () => [],
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

vi.mock('@/hooks/useBlockList', () => ({
  useBlockedPubkeys: () => pm.blocked,
  useBlockUser: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUnblockUser: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/useNip05Validation', () => ({
  useNip05Validation: () => ({ state: pm.nip05State }),
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
    pm.nip05State = 'valid';
    pm.canUseDirectMessages = false;
    pm.approved.clear();
    pm.blocked.clear();
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

    it('hides the Message button on a non-support profile for every user', () => {
      pm.canUseDirectMessages = true;
      renderFor('a'.repeat(64));
      expect(
        screen.queryByRole('button', { name: /message/i }),
      ).not.toBeInTheDocument();
    });

    it('shows the Message button on the Divine Support profile', () => {
      pm.canUseDirectMessages = true;
      renderFor(DIVINE_SUPPORT_PUBKEY);
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
      pm.approved.add(DIVINE_SUPPORT_PUBKEY);
      renderFor(DIVINE_SUPPORT_PUBKEY);
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
      pm.approved.add(DIVINE_SUPPORT_PUBKEY);
      renderFor(DIVINE_SUPPORT_PUBKEY);
      expect(
        screen.getByRole('button', { name: /message/i }),
      ).toBeInTheDocument();
    });
  });

  it('hides the total video count stat', () => {
    render(
      <MemoryRouter>
        <ProfileHeader
          pubkey={'a'.repeat(64)}
          metadata={{ display_name: 'Modern Creator' }}
          stats={baseStats}
          isOwnProfile={false}
          isFollowing={false}
          onFollowToggle={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByText('Videos')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stat-skeleton-videos')).not.toBeInTheDocument();
    expect(screen.getByText('Followers')).toBeInTheDocument();
    expect(screen.getByText('Following')).toBeInTheDocument();
    expect(screen.getByText('Divine Loops')).toBeInTheDocument();
  });

  it('shows blocked profiles with an unblock button', () => {
    const blockedPubkey = 'a'.repeat(64);
    pm.blocked.add(blockedPubkey);

    render(
      <MemoryRouter>
        <ProfileHeader
          pubkey={blockedPubkey}
          metadata={{ display_name: 'Modern Creator' }}
          stats={baseStats}
          isOwnProfile={false}
          isFollowing={true}
          onFollowToggle={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /^unblock user$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^follow$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^following$/i })).not.toBeInTheDocument();
  });

  it('keeps the joined stat in the two-column mobile stats grid', () => {
    render(
      <MemoryRouter>
        <ProfileHeader
          pubkey={'a'.repeat(64)}
          metadata={{ display_name: 'Modern Creator' }}
          stats={{ ...baseStats, joinedDate: new Date(2024, 0, 15) }}
          isOwnProfile={false}
          isFollowing={false}
          onFollowToggle={vi.fn()}
        />
      </MemoryRouter>
    );

    const statsGrid = screen.getByTestId('profile-stats');
    expect(statsGrid).toHaveClass('grid-cols-2', 'sm:grid-cols-4');

    const joinedStat = screen.getByText(/Joined January 2024/).closest('.text-center');
    expect(joinedStat).not.toHaveClass('col-span-2');
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
  describe('friendly website links', () => {
    const pubkey = 'a'.repeat(64);
    const npub = nip19.npubEncode(pubkey);
    const renderWebsite = (website: string, nip05 = '_@alice.divine.video') => render(
      <MemoryRouter>
        <ProfileHeader
          pubkey={pubkey}
          metadata={{ display_name: 'Alice', website, nip05 }}
          stats={baseStats}
          isOwnProfile={false}
          isFollowing={false}
          onFollowToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    it.each([
      `https://divine.video/profile/${pubkey}`,
      `https://divine.video/profile/${npub}`,
      `https://divine.video/${npub}`,
      `https://dvine.video/profile/${pubkey}`,
      `https://www.divine.video/profile/${pubkey}`,
      'divine.video/u/alice',
    ])('replaces an own-profile website with the verified domain', (website) => {
      renderWebsite(website);
      expect(screen.getByRole('link', { name: 'alice.divine.video' }))
        .toHaveAttribute('href', 'https://alice.divine.video');
      expect(screen.queryByRole('link', { name: website })).not.toBeInTheDocument();
    });

    it.each([
      `https://divine.video/u/alice.divine.video`,
      `https://divine.video/u/${encodeURIComponent('_@alice.divine.video')}`,
      `https://divine.video/profile/alice@divine.video`,
    ])('replaces an own-profile link spelled as a NIP-05 identity form', (website) => {
      renderWebsite(website);
      expect(screen.getByRole('link', { name: 'alice.divine.video' }))
        .toHaveAttribute('href', 'https://alice.divine.video');
      expect(screen.queryByRole('link', { name: website })).not.toBeInTheDocument();
    });

    it('replaces a raw NIP-05 self link with the friendly profile path for a third-party identity', () => {
      renderWebsite('https://divine.video/u/alice@example.com', 'alice@example.com');
      expect(screen.getByRole('link', { name: 'divine.video/u/alice.example.com' }))
        .toHaveAttribute('href', 'https://divine.video/u/alice.example.com');
    });

    it('preserves query and fragment when using the friendly destination', () => {
      renderWebsite(`https://divine.video/profile/${pubkey}?tab=videos#pinned`);
      expect(screen.getByRole('link', { name: 'alice.divine.video' }))
        .toHaveAttribute('href', 'https://alice.divine.video?tab=videos#pinned');
    });

    it('uses the friendly profile path for a verified third-party NIP-05', () => {
      renderWebsite(`https://divine.video/profile/${pubkey}`, 'alice@example.com');
      expect(screen.getByRole('link', { name: 'divine.video/u/alice.example.com' }))
        .toHaveAttribute('href', 'https://divine.video/u/alice.example.com');
    });

    it.each(['loading', 'invalid', 'idle'])('keeps the original link while NIP-05 is %s', (state) => {
      pm.nip05State = state;
      const website = `https://divine.video/profile/${pubkey}`;
      renderWebsite(website);
      expect(screen.getByRole('link', { name: website })).toHaveAttribute('href', website);
    });

    it.each([
      'https://example.com/my-work',
      `https://divine.video/profile/${'b'.repeat(64)}`,
      `https://divine.video.evil.example/profile/${pubkey}`,
      'https://divine.video/about',
      'https://divine.video/u/mallory.divine.video',
    ])('keeps external websites and other destinations unchanged', (website) => {
      renderWebsite(website);
      expect(screen.getByRole('link', { name: website })).toHaveAttribute('href', website);
    });
  });

});
