import { Sentry } from '@/lib/sentry';

export type ContentOutcome = 'ready' | 'empty' | 'error';
type Outcome = ContentOutcome | 'timeout' | 'cancelled';

export function startContentLoad(route: string, key: string, initial: boolean, onSettled: () => void) {
  const root = document.documentElement;
  const span = Sentry.startInactiveSpan({ name: route, op: 'ui.content_ready', forceTransaction: true,
    startTime: initial ? performance.timeOrigin / 1000 : undefined,
    attributes: { 'route.name': route, 'navigation.type': initial ? 'pageload' : 'navigation' } });
  let finished = false;
  let frame: number | undefined;
  const timeout = window.setTimeout(() => finish('timeout'), 30_000);
  const onVisibility = () => { if (document.visibilityState === 'hidden') finish('cancelled'); };
  function finish(outcome: Outcome, notify = true) {
    if (finished) return;
    finished = true;
    window.clearTimeout(timeout);
    document.removeEventListener('visibilitychange', onVisibility);
    if (frame !== undefined) cancelAnimationFrame(frame);
    span?.setAttribute('content.outcome', outcome);
    span?.setStatus(outcome === 'ready' || outcome === 'empty' ? { code: 1 }
      : { code: 2, message: outcome === 'timeout' ? 'deadline_exceeded' : outcome });
    span?.end();
    if (notify) onSettled();
    root.dataset.performanceOutcome = outcome;
    if (outcome === 'ready' || outcome === 'empty' || outcome === 'error') root.dataset.performanceReady = 'true';
  }
  document.addEventListener('visibilitychange', onVisibility);
  // A route opened in a background tab gets no frames until it is shown.
  onVisibility();
  return { key, finish, report(outcome: ContentOutcome) {
    if (finished || frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => finish(outcome));
    });
  } };
}
