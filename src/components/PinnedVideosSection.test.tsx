import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PinnedVideosSection } from './PinnedVideosSection';
import { initializeI18n } from '@/lib/i18n';

vi.mock('@nostrify/react', () => ({ useNostr: () => ({ nostr: { query: vi.fn() } }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [
    { id: 'hidden', vineId: 'one', ageRestricted: true },
    { id: 'public', vineId: 'two', ageRestricted: false },
  ], isLoading: false }),
}));
vi.mock('@/hooks/usePinnedVideos', () => ({
  usePinnedVideos: () => ({ data: [`34236:${'a'.repeat(64)}:one`, `34236:${'a'.repeat(64)}:two`], isLoading: false }),
  useUnpinVideo: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/VideoGrid', () => ({
  VideoGrid: ({ videos }: { videos: Array<{ id: string }> }) => <div>{videos.map(video => <span key={video.id}>{video.id}</span>)}</div>,
}));

describe('PinnedVideosSection viewing preference', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initializeI18n({ force: true, languages: ['en-US'] });
    localStorage.setItem('hide-age-restricted-videos', 'true');
  });

  it('keeps visible pins and owner unpin controls aligned', () => {
    render(<PinnedVideosSection pubkey={'a'.repeat(64)} isOwnProfile />);
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /unpin/i })).toHaveLength(1);
  });

  it('omits the whole section when every pin is hidden', () => {
    localStorage.setItem('discovered-age-restricted-video-ids', JSON.stringify(['public']));
    const { container } = render(<PinnedVideosSection pubkey={'a'.repeat(64)} isOwnProfile />);
    expect(container).toBeEmptyDOMElement();
  });
});
