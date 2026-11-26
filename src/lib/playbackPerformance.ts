import { Sentry } from '@/lib/sentry';

export function observeVideoStartup(route: string): () => void {
  let video: HTMLVideoElement | null = null;
  let span: ReturnType<typeof Sentry.startInactiveSpan>;
  let frame: number | undefined;
  let timeout: ReturnType<typeof setTimeout>;
  let finished = false;
  const finish = (outcome: 'ready' | 'error' | 'cancelled' | 'timeout') => {
    if (!span || finished) return;
    finished = true;
    clearTimeout(timeout);
    if (frame !== undefined) video?.cancelVideoFrameCallback?.(frame);
    span.setAttribute('playback.outcome', outcome);
    span.setStatus(outcome === 'ready' ? { code: 1 } : { code: 2, message: outcome });
    span.end();
  };
  const onPlay = (event: Event) => {
    if (video || document.visibilityState !== 'visible' || !(event.target instanceof HTMLVideoElement)) return;
    const bounds = event.target.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || bounds.bottom <= 0 || bounds.top >= innerHeight) return;
    if (bounds.right <= 0 || bounds.left >= innerWidth) return;
    video = event.target;
    span = Sentry.startInactiveSpan({ name: route, op: 'ui.video.start', forceTransaction: true,
      attributes: { 'route.name': route } });
    timeout = setTimeout(() => finish('timeout'), 30_000);
  };
  const onFirstFrame = () => finish(document.visibilityState === 'visible' ? 'ready' : 'cancelled');
  const onPlaying = (event: Event) => {
    if (finished || event.target !== video || !video || frame !== undefined) return;
    if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(onFirstFrame);
    else onFirstFrame();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') finish('cancelled');
  };
  const onError = (event: Event) => { if (event.target === video) finish('error'); };
  document.addEventListener('play', onPlay, true);
  document.addEventListener('playing', onPlaying, true);
  document.addEventListener('error', onError, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    document.removeEventListener('play', onPlay, true);
    document.removeEventListener('playing', onPlaying, true);
    document.removeEventListener('error', onError, true);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    finish('cancelled');
  };
}
