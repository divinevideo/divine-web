import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18n } from '@/lib/i18n';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { TagPage } from './TagPage';

vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: () => <div data-testid="video-feed-hashtag" />,
}));

describe('TagPage', () => {
  beforeEach(async () => {
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

    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('renders the invalid-tag state in spanish', () => {
    render(
      <MemoryRouter initialEntries={['/tag/']}>
        <Routes>
          <Route path="/tag/" element={<TagPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Etiqueta no encontrada.' })).toBeInTheDocument();
    expect(screen.getByText('No encontramos esa etiqueta.')).toBeInTheDocument();
  });

  it('renders the tag header copy in spanish', () => {
    render(
      <MemoryRouter initialEntries={['/tag/Funny']}>
        <Routes>
          <Route path="/tag/:tag" element={<TagPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Atras' })).toBeInTheDocument();
    expect(screen.getByText('Loops etiquetados con #funny')).toBeInTheDocument();
  });
});
