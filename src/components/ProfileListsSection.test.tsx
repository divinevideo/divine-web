// ABOUTME: Tests the mixed list shelf displayed above profile videos

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import { ProfileListsSection } from './ProfileListsSection';

const OWNER = 'a'.repeat(64);
const mockUsePeopleLists = vi.fn();
const mockUseVideoLists = vi.fn();

vi.mock('@/hooks/usePeopleLists', () => ({
  usePeopleLists: (...args: unknown[]) => mockUsePeopleLists(...args),
}));
vi.mock('@/hooks/useVideoLists', () => ({
  useVideoLists: (...args: unknown[]) => mockUseVideoLists(...args),
}));

function listResult(data: unknown[] = [], isLoading = false, isError = false) {
  return { data, isLoading, isError };
}

describe('ProfileListsSection', () => {
  beforeEach(() => {
    mockUsePeopleLists.mockReturnValue(listResult());
    mockUseVideoLists.mockReturnValue(listResult());
  });

  it('shows a loading shelf while either initial query is pending', () => {
    mockUsePeopleLists.mockReturnValue(listResult([], true));
    const { container } = render(<ProfileListsSection pubkey={OWNER} />, { wrapper: MemoryRouter });
    expect(container.querySelectorAll('[data-list-skeleton]')).toHaveLength(3);
    expect(screen.queryByRole('heading', { name: 'Lists' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'See all' })).not.toBeInTheDocument();
  });

  it('hides after both sources finish empty', () => {
    const { container } = render(<ProfileListsSection pubkey={OWNER} />, { wrapper: MemoryRouter });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the three newest mixed lists and preserves a successful partial result', () => {
    mockUsePeopleLists.mockReturnValue(listResult([
      { id: 'people-new', name: 'People new', pubkey: OWNER, createdAt: 40, memberPubkeys: [] },
      { id: 'people-old', name: 'People old', pubkey: OWNER, createdAt: 10, memberPubkeys: [] },
    ]));
    mockUseVideoLists.mockReturnValue({
      ...listResult([
        { id: 'video-new', name: 'Video new', pubkey: OWNER, createdAt: 30, videoCoordinates: [], public: true },
        { id: 'video-mid', name: 'Video mid', pubkey: OWNER, createdAt: 20, videoCoordinates: [], public: true },
      ]),
      isError: true,
    });

    render(<ProfileListsSection pubkey={OWNER} />, { wrapper: MemoryRouter });

    expect(screen.getByText('People new')).toBeInTheDocument();
    expect(screen.getByText('Video new')).toBeInTheDocument();
    expect(screen.getByText('Video mid')).toBeInTheDocument();
    expect(screen.queryByText('People old')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      `/profile/${nip19.npubEncode(OWNER)}/lists`,
    );
  });
});
