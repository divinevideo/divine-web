// ABOUTME: Tests for UnifiedListCard — polymorphic dispatch over Nostr list kinds
// ABOUTME: Verifies kind 30000 renders PeopleListCard and kind 30005 renders VideoListCard

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedListCard } from './UnifiedListCard';
import type { PeopleList } from '@/types/peopleList';
import type { VideoList } from '@/hooks/useVideoLists';

// ---- mock buildListPath so PeopleListCard renders without routing complexity ---

vi.mock('@/lib/eventRouting', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eventRouting')>('@/lib/eventRouting');
  return {
    ...actual,
    buildListPath: (pubkey: string, listId: string) => `/list/${pubkey}/${listId}`,
  };
});

// ---- shared fixtures ---------------------------------------------------------

const PUBKEY = 'a'.repeat(64);

const PEOPLE_LIST: PeopleList = {
  id: 'cool-people',
  pubkey: PUBKEY,
  name: 'Cool People',
  description: 'Great humans.',
  members: ['b'.repeat(64), 'c'.repeat(64)],
  createdAt: 1_700_000_000,
};

const VIDEO_LIST: VideoList = {
  id: 'best-vines',
  name: 'Best Vines',
  description: 'Classic loops.',
  pubkey: PUBKEY,
  createdAt: 1_700_000_000,
  videoCoordinates: ['34236:aaa:1'],
  public: true,
};

function wrap(children: React.ReactNode) {
  return render(<MemoryRouter>{children}</MemoryRouter>);
}

// ---- tests -------------------------------------------------------------------

describe('UnifiedListCard', () => {
  it('renders PeopleListCard for kind 30000', () => {
    wrap(<UnifiedListCard kind={30000} list={PEOPLE_LIST} />);

    // PeopleListCard shows a member-count badge; VideoListCard shows a video-count badge
    expect(screen.getByTestId('member-count-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('video-count-badge')).not.toBeInTheDocument();
    expect(screen.getByText('Cool People')).toBeInTheDocument();
  });

  it('renders VideoListCard for kind 30005', () => {
    wrap(<UnifiedListCard kind={30005} list={VIDEO_LIST} />);

    expect(screen.getByTestId('video-count-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('member-count-badge')).not.toBeInTheDocument();
    expect(screen.getByText('Best Vines')).toBeInTheDocument();
  });

  it('threads previews into PeopleListCard so loaded avatars render', () => {
    const previews = {
      getMemberMetadata: (pubkey: string) =>
        pubkey === 'b'.repeat(64) ? { picture: 'https://cdn.example/avatar-b.jpg' } : undefined,
      getVideoThumbnail: () => undefined,
    };

    const { container } = wrap(
      <UnifiedListCard kind={30000} list={PEOPLE_LIST} previews={previews} />,
    );

    const img = container.querySelector('img[src="https://cdn.example/avatar-b.jpg"]');
    expect(img).not.toBeNull();
  });

  it('threads previews into VideoListCard so the first-video thumbnail overrides list.image', () => {
    const previews = {
      getMemberMetadata: () => undefined,
      getVideoThumbnail: (pubkey: string, listId: string) =>
        pubkey === PUBKEY && listId === 'best-vines'
          ? 'https://cdn.example/thumb.jpg'
          : undefined,
    };

    wrap(<UnifiedListCard kind={30005} list={VIDEO_LIST} previews={previews} />);

    const img = screen.getByTestId('video-list-cover-image');
    expect(img).toHaveAttribute('src', 'https://cdn.example/thumb.jpg');
  });
});
