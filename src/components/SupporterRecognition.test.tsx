import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeI18n } from '@/lib/i18n';
import { useSupporter } from '@/hooks/useSupporter';
import { usePublicSupporter } from '@/hooks/usePublicSupporter';
import { OwnSupporterRecognition, PublicSupporterRecognition } from './SupporterRecognition';

vi.mock('@/hooks/useSupporter', () => ({
  useSupporter: vi.fn(),
}));
vi.mock('@/hooks/usePublicSupporter', () => ({
  usePublicSupporter: vi.fn(),
}));
beforeEach(async () => {
  await initializeI18n({ force: true, languages: ['en-US'] });
});
describe('supporter recognition', () => {
  it('thanks the owner even when recognition is private', () => {
    vi.mocked(useSupporter).mockReturnValue(
      { isActive: true } as ReturnType<typeof useSupporter>,
    );
    render(
      <MemoryRouter>
        <OwnSupporterRecognition />
      </MemoryRouter>,
    );
    expect(screen.getByText('Supporter')).toBeInTheDocument();
    expect(screen.getByText('Thank you for supporting Divine.')).toBeInTheDocument();
  });
  it.each([false, undefined])('does not expose a chip for absent public recognition (%s)', (data) => {
    vi.mocked(usePublicSupporter).mockReturnValue(
      { data, isError: false } as ReturnType<typeof usePublicSupporter>,
    );
    render(
      <PublicSupporterRecognition pubkey={'a'.repeat(64)} />,
    );
    expect(screen.queryByText('Supporter')).not.toBeInTheDocument();
  });
  it('shows opt-in public recognition', () => {
    vi.mocked(usePublicSupporter).mockReturnValue(
      { data: true, isError: false } as ReturnType<typeof usePublicSupporter>,
    );
    render(
      <PublicSupporterRecognition pubkey={'a'.repeat(64)} />,
    );
    expect(screen.getByText('Supporter')).toBeInTheDocument();
  });
});
