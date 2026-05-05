// ABOUTME: Tests for VideoListCard — discovery card for a video list (kind 30005)
// ABOUTME: Covers title, description, cover image / placeholder fallback

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VideoListCard } from './VideoListCard';
import type { VideoList } from '@/hooks/useVideoLists';

// ---- shared fixtures ---------------------------------------------------------

const PUBKEY = 'a'.repeat(64);

const LIST: VideoList = {
  id: 'best-vines',
  name: 'Best Vines',
  description: 'A handpicked collection of classic loops.',
  image: 'https://example.com/cover.jpg',
  pubkey: PUBKEY,
  createdAt: 1_700_000_000,
  videoCoordinates: ['34236:aaa:1', '34236:bbb:2'],
  public: true,
};

const LIST_NO_IMAGE: VideoList = {
  ...LIST,
  id: 'no-image-list',
  image: undefined,
};

const LIST_NO_DESCRIPTION: VideoList = {
  ...LIST,
  id: 'no-desc-list',
  description: undefined,
};

function renderCard(list: VideoList = LIST) {
  return render(
    <MemoryRouter>
      <VideoListCard list={list} />
    </MemoryRouter>,
  );
}

// ---- tests -------------------------------------------------------------------

describe('VideoListCard', () => {
  it('renders the title', () => {
    renderCard();

    expect(screen.getByText('Best Vines')).toBeInTheDocument();
  });

  it('renders description when present, omits it when absent', () => {
    const { unmount } = renderCard();
    expect(screen.getByText('A handpicked collection of classic loops.')).toBeInTheDocument();
    unmount();

    renderCard(LIST_NO_DESCRIPTION);
    expect(screen.queryByText('A handpicked collection of classic loops.')).not.toBeInTheDocument();
  });

  it('links to the canonical list detail route /list/<pubkey>/<dTag>', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/list/${PUBKEY}/best-vines`);
  });

  it('renders cover image when list.image is set, falls back to placeholder otherwise', () => {
    const { unmount } = renderCard();
    expect(screen.getByTestId('video-list-cover-image')).toBeInTheDocument();
    expect(screen.queryByTestId('video-list-cover-placeholder')).not.toBeInTheDocument();
    unmount();

    renderCard(LIST_NO_IMAGE);
    expect(screen.queryByTestId('video-list-cover-image')).not.toBeInTheDocument();
    expect(screen.getByTestId('video-list-cover-placeholder')).toBeInTheDocument();
  });
});
