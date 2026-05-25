import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollToTop } from './ScrollToTop';

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

  it('restores the saved scroll position when returning to a route', () => {
    render(<TestApp />);

    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);

    scrollY = 420;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);

    scrollY = 125;
    fireEvent.click(screen.getByRole('link', { name: 'Feed' }));

    expect(screen.getByRole('heading', { name: 'Feed' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 420);
  });
});
