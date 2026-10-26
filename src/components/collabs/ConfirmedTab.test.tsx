import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmedTab } from './ConfirmedTab';
import { initializeI18n } from '@/lib/i18n';

vi.mock('@/hooks/useMyConfirmedCollabs', () => ({
  useMyConfirmedCollabs: () => ({
    data: [{ id: 'restricted', ageRestricted: true }, { id: 'public' }],
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/lib/funnelcakeTransform', () => ({
  transformFunnelcakeVideo: (video: unknown) => video,
}));

vi.mock('@/components/VideoCard', () => ({
  VideoCard: ({ video }: { video: { id: string } }) => <div>{video.id}</div>,
}));

describe('ConfirmedTab viewing preference', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('omits restricted videos when the browser hide preference is active', () => {
    localStorage.setItem('hide-age-restricted-videos', 'true');
    render(<ConfirmedTab />);

    expect(screen.queryByText('restricted')).not.toBeInTheDocument();
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  it('shows the viewing preference instead of a blank grid when all collaborations are hidden', () => {
    localStorage.setItem('hide-age-restricted-videos', 'true');
    localStorage.setItem('discovered-age-restricted-video-ids', JSON.stringify(['public']));
    render(<ConfirmedTab />);

    expect(screen.getByRole('button', { name: /show age-restricted videos/i })).toBeInTheDocument();
  });
});
