interface PendingRequest<T> {
  promise: Promise<T>;
  controller: AbortController;
  consumers: number;
  settled: boolean;
}

const pendingRequests = new Map<string, PendingRequest<unknown>>();

function subscribe<T>(key: string, pending: PendingRequest<T>, signal?: AbortSignal): Promise<T> {
  pending.consumers++;
  return new Promise((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener('abort', abort);
      if (--pending.consumers === 0 && !pending.settled) {
        pending.controller.abort();
        if (pendingRequests.get(key) === pending) pendingRequests.delete(key);
      }
      return true;
    };
    const abort = () => {
      if (release()) reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    pending.promise.then(
      value => { if (release()) resolve(value); },
      error => { if (release()) reject(error); },
    );
    if (signal?.aborted) abort();
  });
}

export function shareRequest<T>(key: string, request: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  let pending = pendingRequests.get(key) as PendingRequest<T> | undefined;
  if (!pending) {
    const controller = new AbortController();
    const entry: PendingRequest<T> = {
      controller, consumers: 0, settled: false,
      promise: Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return request(controller.signal);
      }).finally(() => {
        entry.settled = true;
        if (pendingRequests.get(key) === entry) pendingRequests.delete(key);
      }),
    };
    pendingRequests.set(key, entry);
    pending = entry;
  }
  return subscribe(key, pending, signal);
}
