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

/** `window.scrollTo` is overloaded; a mock has to handle either call shape. */
type ScrollToArgs = [x: number, y: number] | [options?: ScrollToOptions];

/** The requested offset, from either `scrollTo(x, y)` or `scrollTo({ top })`. */
function requestedOffset(args: ScrollToArgs): number {
  const [first, second] = args;
  return Number(typeof first === 'number' ? second : first?.top);
}

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
    vi.mocked(window.scrollTo).mockImplementation((...args: ScrollToArgs) => {
      scrollY = Math.min(requestedOffset(args), maxScroll);
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

  // `html { scroll-behavior: smooth }` applies app-wide, and the positional
  // `scrollTo(x, y)` form scrolls with behavior "auto", which resolves to it.
  // That animates the restore, so every frame reads short of the target and the
  // loop chases its own animation instead of the page height — and stopping the
  // loop does not stop the animation, so the page keeps travelling after the
  // viewer takes over. The restore must opt out of it explicitly.
  it('restores without starting the page-level smooth scroll', async () => {
    const TestApp = makeTestApp(await loadScrollToTop());
    render(<TestApp />);

    scrollY = 1800;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    scrollY = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 1800, behavior: 'instant' });
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

  // An interrupted restore is holding a clamped position, not a real one.
  // Saving it would overwrite the offset the restore was chasing and walk the
  // feed toward the top on every interrupted back-navigation.
  it('does not overwrite the saved position when a restore is interrupted', async () => {
    const TestApp = makeTestApp(await loadScrollToTop());
    render(<TestApp />);

    scrollY = 1800;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    // Back, but the grid has not laid out, so the restore clamps to 150.
    scrollY = 0;
    maxScroll = 150;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(window.scrollY).toBe(150);

    // Navigate away again before the retry loop can land the position.
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    // Back once more, this time with the page fully laid out. The original
    // 1800 must have survived the interrupted attempt.
    scrollY = 0;
    maxScroll = 10_000;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await nextFrame();

    expect(window.scrollY).toBe(1800);
  });

  // Cancelling the retry loop is not the same as moving the page. A click hands
  // control back without scrolling anywhere, so what is on screen is still the
  // clamped offset the loop wrote — persisting it loses the one being chased.
  // The case above passes either way because `fireEvent.click` dispatches no
  // `mousedown`, and the scrollbar-drag case sets a new `scrollY` afterwards,
  // which is the branch where the viewer really did move.
  it('does not overwrite the saved position when a click cancels a restore', async () => {
    const TestApp = makeTestApp(await loadScrollToTop());
    render(<TestApp />);

    scrollY = 1800;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    scrollY = 0;
    maxScroll = 150;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(window.scrollY).toBe(150);

    // The viewer clicks a video while the grid is still filling in. The
    // viewport never moved off the clamped 150.
    fireEvent.mouseDown(window);
    maxScroll = 10_000;
    await nextFrame();
    expect(window.scrollY).toBe(150);

    // Follow the click through, then come back to a fully laid out page.
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));
    scrollY = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await nextFrame();

    expect(window.scrollY).toBe(1800);
  });

  // The mirror of the two cases above. Not persisting an interrupted restore
  // must not cost the viewer a position they really did choose — and the
  // offset most at risk is the one the interrupted loop happened to leave
  // behind, because a clamped restore on a grid that has not laid out leaves
  // exactly `0`. Asking whether the loop stopped, or comparing the final offset
  // against what the loop last wrote, both read this as "not the viewer's".
  it('persists the top of the feed after an interrupted restore', async () => {
    const TestApp = makeTestApp(await loadScrollToTop());
    render(<TestApp />);

    scrollY = 1800;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    // Back onto a grid with no rows yet: the restore is clamped all the way to
    // the top, which is the offset the loop is now holding.
    scrollY = 0;
    maxScroll = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(window.scrollY).toBe(0);

    // The viewer clicks, taking control without moving the page.
    fireEvent.mouseDown(window);
    maxScroll = 10_000;
    await nextFrame();

    // They read down, then come back to the top and open a video from there.
    scrollY = 3000;
    fireEvent.scroll(window);
    scrollY = 0;
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    // The top is where they left the feed, so that is where they come back to.
    scrollY = 900;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await nextFrame();

    expect(window.scrollY).toBe(0);
  });

  it('persists a position the viewer scrolls to after a restore lands', async () => {
    const TestApp = makeTestApp(await loadScrollToTop());
    render(<TestApp />);

    scrollY = 1800;
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    scrollY = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await nextFrame();
    expect(window.scrollY).toBe(1800);

    // The restore is done; the viewer reads on and leaves from 4000.
    scrollY = 4000;
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));

    scrollY = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await nextFrame();

    expect(window.scrollY).toBe(4000);
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
