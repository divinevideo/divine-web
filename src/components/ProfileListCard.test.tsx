// ABOUTME: Tests the labeled mixed-list card used on profiles

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { DiscoverableList } from '@/lib/profileLists';
import { ProfileListCard } from './ProfileListCard';

const OWNER = 'a'.repeat(64);

function renderCard(type: DiscoverableList['type']) {
  const list: DiscoverableList = {
    key: `${type}:${OWNER}:friends`,
    type,
    id: 'friends',
    name: type === 'people' ? 'Friends' : 'Favorites',
    description: 'A very good list',
    ownerPubkey: OWNER,
    createdAt: 10,
    itemCount: type === 'people' ? 2 : 3,
    href: type === 'people'
      ? `/people-lists/${OWNER}/friends`
      : `/list/${OWNER}/friends`,
  };

  render(<ProfileListCard list={list} />, { wrapper: MemoryRouter });
}

describe('ProfileListCard', () => {
  it('labels and links a people list', () => {
    renderCard('people');
    expect(screen.getByText('People list')).toBeInTheDocument();
    expect(screen.getByText('2 people')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Friends/ })).toHaveAttribute(
      'href',
      `/people-lists/${OWNER}/friends`,
    );
  });

  it('labels and links a video list', () => {
    renderCard('videos');
    expect(screen.getByText('Video list')).toBeInTheDocument();
    expect(screen.getByText('3 videos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Favorites/ })).toHaveAttribute(
      'href',
      `/list/${OWNER}/friends`,
    );
  });
});
