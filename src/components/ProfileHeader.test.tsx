import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProfileHeader } from './ProfileHeader';
import type { ProfileStats } from '@/lib/profileStats';

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

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: false }),
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
});
