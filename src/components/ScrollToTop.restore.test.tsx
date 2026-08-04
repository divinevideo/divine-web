// ABOUTME: Tests scroll restoration when content lays out after the restore attempt
// ABOUTME: divine-web#379 — profile grid reset to top because the page was still short

import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

function BackButton() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back</button>;
}

// ScrollToTop keeps saved positions in module scope, so each test needs a fresh
// import or one test's saved position leaks into the next.
async function loadScrollToTop() {
  vi.resetModules();
  return (await import('./ScrollToTop')).ScrollToTop;
}

function makeTestApp(ScrollToTop: React.ComponentType) {
  return () => (
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
              <BackButton />
            </div>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

const nextFrame = () => new Promise(resolve => setTimeout(resolve, 32));

describe('ScrollToTop restoration against late-loading content', () => {
  let scrollY = 0;
  /** Tallest position the "browser" will accept — grows as content lays out. */
  let maxScroll = 0;

  beforeEach(() => {
    scrollY = 0;
    maxScroll = 10_000;
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => scrollY,
    });
    // Real browsers clamp a scroll request to the current document height. An
    // infinite grid that hasn't rendered its rows yet is short, so the restore
    // lands near the top.
    vi.mocked(window.scrollTo).mockImplementation((_x, y) => {
      scrollY = Math.min(Number(y), maxScroll);
    });
  });

  afterEach(() => {
    vi.mocked(window.scrollTo).mockReset();
  });

  it('keeps trying until the grown page can hold the saved position', async () => {
    const TestApp = makeTestApp(await loadScrollToTop());
    render(<TestApp />);

    scrollY = 1800;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();

    // Coming back, the profile grid has not rendered its rows yet.
    scrollY = 0;
    maxScroll = 150;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Feed' })).toBeInTheDocument();

    // The first attempt is clamped — this is the reported bug.
    expect(window.scrollY).toBe(150);

    // Cached pages render and the document grows.
    maxScroll = 10_000;
    await nextFrame();

    expect(window.scrollY).toBe(1800);
  });

  it('stops fighting the user if they scroll during restoration', async () => {
    const TestApp = makeTestApp(await loadScrollToTop());
    render(<TestApp />);

    scrollY = 1800;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    scrollY = 0;
    maxScroll = 150;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(window.scrollY).toBe(150);

    // User grabs the page before the grid finishes loading.
    fireEvent.wheel(window);
    maxScroll = 10_000;
    scrollY = 300;
    await nextFrame();

    expect(window.scrollY).toBe(300);
  });

  // Grabbing the scrollbar fires neither wheel nor touchstart nor keydown, and
  // it is the natural way out of a page the retry loop cannot satisfy.
  it('stops fighting the user if they drag the scrollbar during restoration', async () => {
    const TestApp = makeTestApp(await loadScrollToTop());
    render(<TestApp />);

    scrollY = 1800;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    scrollY = 0;
    maxScroll = 150;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(window.scrollY).toBe(150);

    fireEvent.mouseDown(window);
    maxScroll = 10_000;
    scrollY = 300;
    await nextFrame();

    expect(window.scrollY).toBe(300);
  });

  it('still lands at the top on forward navigation', async () => {
    const TestApp = makeTestApp(await loadScrollToTop());
    render(<TestApp />);
    expect(window.scrollY).toBe(0);

    scrollY = 900;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    expect(window.scrollY).toBe(0);
    await nextFrame();
    expect(window.scrollY).toBe(0);
  });
});
