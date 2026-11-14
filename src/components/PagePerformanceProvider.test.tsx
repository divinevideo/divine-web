import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PagePerformanceProvider } from './PagePerformanceProvider';
import { usePageContentReady } from '@/hooks/usePageContentReady';

const { startSpan, spans } = vi.hoisted(() => ({ startSpan: vi.fn(), spans: [] as Array<{ end: ReturnType<typeof vi.fn>; setStatus: ReturnType<typeof vi.fn>; setAttribute: ReturnType<typeof vi.fn> }> }));
vi.mock('@/lib/sentry', () => ({ Sentry: { startInactiveSpan: startSpan } }));

function Content({ ready = false, outcome = 'ready' }: { ready?: boolean; outcome?: 'ready' | 'empty' | 'error' }) {
  usePageContentReady(ready ? outcome : null);
  const navigate = useNavigate();
  return <button onClick={() => navigate('/video/synthetic')}>Next</button>;
}
function Page({ ready = false, outcome = 'ready' }: { ready?: boolean; outcome?: 'ready' | 'empty' | 'error' }) {
  return <MemoryRouter initialEntries={['/u/synthetic']}><PagePerformanceProvider><Content ready={ready} outcome={outcome} /></PagePerformanceProvider></MemoryRouter>;
}

beforeEach(() => {
  vi.useFakeTimers();
  spans.length = 0;
  startSpan.mockImplementation(() => { const span = { end: vi.fn(), setStatus: vi.fn(), setAttribute: vi.fn() }; spans.push(span); return span; });
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('page content readiness', () => {
  it('waits for primary data and a paint before marking ready, once', () => {
    const view = render(<Page />);
    expect(document.documentElement.dataset.performanceReady).toBe('false');
    view.rerender(<Page ready />);
    expect(spans[0].end).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(40));
    expect(document.documentElement.dataset.performanceReady).toBe('true');
    expect(spans[0].setAttribute).toHaveBeenCalledWith('content.outcome', 'ready');
    expect(spans[0].end).toHaveBeenCalledTimes(1);
    view.rerender(<Page ready />);
    act(() => vi.advanceTimersByTime(40));
    expect(spans[0].end).toHaveBeenCalledTimes(1);
  });
  it.each(['empty', 'error'] as const)('reports %s separately from successful content', (outcome) => {
    render(<Page ready outcome={outcome} />);
    act(() => vi.advanceTimersByTime(40));
    expect(document.documentElement.dataset.performanceOutcome).toBe(outcome);
  });
  it('ends a stalled route as timeout without marking content ready', () => {
    render(<Page />);
    act(() => vi.advanceTimersByTime(30_001));
    expect(spans[0].setStatus).toHaveBeenCalledWith({ code: 2, message: 'deadline_exceeded' });
    expect(document.documentElement.dataset.performanceOutcome).toBe('timeout');
    expect(document.documentElement.dataset.performanceReady).toBe('false');
  });
  it('cancels old routes and clears readiness on navigation', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(spans[0].setAttribute).toHaveBeenCalledWith('content.outcome', 'cancelled');
    expect(spans[0].end).toHaveBeenCalledOnce();
    expect(spans).toHaveLength(2);
    expect(document.documentElement.dataset.performanceReady).toBe('false');
  });
  it('does not record an unmounted route as ready', () => {
    const view = render(<Page ready />);
    view.unmount();
    act(() => vi.advanceTimersByTime(40));
    expect(document.documentElement.dataset.performanceReady).toBeUndefined();
    expect(spans[0].setAttribute).toHaveBeenCalledWith('content.outcome', 'cancelled');
  });
});

it('measures play intent until playing separately from content readiness', () => {
  render(<Page ready />);
  const video = document.createElement('video');
  vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({ width: 200, height: 200, bottom: 200, top: 0 } as DOMRect);
  document.body.append(video);
  fireEvent.play(video);
  expect(spans).toHaveLength(2);
  expect(startSpan).toHaveBeenLastCalledWith(expect.objectContaining({ name: '/u/:userId', op: 'ui.video.start' }));
  expect(spans[1].end).not.toHaveBeenCalled();
  fireEvent.playing(video);
  expect(spans[1].end).toHaveBeenCalledOnce();
  video.remove();
});

it('excludes time spent in a background tab from content readiness', () => {
  render(<Page />);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  fireEvent(document, new Event('visibilitychange'));
  expect(spans[0].setAttribute).toHaveBeenCalledWith('content.outcome', 'cancelled');
  expect(document.documentElement.dataset.performanceReady).toBe('false');
  vi.restoreAllMocks();
});

it('waits for a presented video frame and cancels its callback on unmount', () => {
  const view = render(<Page />);
  const video = document.createElement('video');
  vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({ width: 200, height: 200, bottom: 200, top: 0 } as DOMRect);
  const request = vi.fn(() => 7);
  const cancel = vi.fn();
  Object.assign(video, { requestVideoFrameCallback: request, cancelVideoFrameCallback: cancel });
  document.body.append(video);
  fireEvent.play(video);
  fireEvent.playing(video);
  expect(request).toHaveBeenCalledOnce();
  expect(spans[1].end).not.toHaveBeenCalled();
  view.unmount();
  expect(cancel).toHaveBeenCalledWith(7);
  expect(spans[1].setAttribute).toHaveBeenCalledWith('playback.outcome', 'cancelled');
  video.remove();
});
