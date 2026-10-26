import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmedTab } from './ConfirmedTab';

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
  beforeEach(() => localStorage.clear());

  it('omits restricted videos when the browser hide preference is active', () => {
    localStorage.setItem('hide-age-restricted-videos', 'true');
    render(<ConfirmedTab />);

    expect(screen.queryByText('restricted')).not.toBeInTheDocument();
    expect(screen.getByText('public')).toBeInTheDocument();
  });
});
