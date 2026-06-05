import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollToTop } from './ScrollToTop';

function BackButton() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back</button>;
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/feed']}>
      <ScrollToTop />
      <Routes>
        <Route
          path="/feed"
          element={
            <div>
              <h1>Feed</h1>
              <Link to="/details">Details</Link>
            </div>
          }
        />
        <Route
          path="/details"
          element={
            <div>
              <h1>Details</h1>
              <Link to="/feed">Feed</Link>
              <BackButton />
            </div>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ScrollToTop', () => {
  let scrollY = 0;

  beforeEach(() => {
    scrollY = 0;
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => scrollY,
    });
    vi.mocked(window.scrollTo).mockImplementation((_x, y) => {
      scrollY = Number(y);
    });
  });

  it('scrolls to the top on forward (PUSH) navigation, even with a saved position', () => {
    render(<TestApp />);

    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);

    scrollY = 420;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);

    // Returning to /feed via a link is a PUSH — it should land at the top,
    // not restore the 420 position saved when we left.
    scrollY = 125;
    fireEvent.click(screen.getByRole('link', { name: 'Feed' }));

    expect(screen.getByRole('heading', { name: 'Feed' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
  });

  it('restores the saved scroll position on back (POP) navigation', () => {
    render(<TestApp />);

    // Leave /feed at y=420; that position is saved for /feed.
    scrollY = 420;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();

    // Browser back (navigate(-1)) is a POP — restore the saved /feed position.
    scrollY = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('heading', { name: 'Feed' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 420);
  });
});
