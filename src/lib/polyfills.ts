/**
 * Polyfill for localStorage in restricted environments
 *
 * Some in-app browsers (Twitter WebView, Samsung Internet in certain modes)
 * set `localStorage` to null or throw on access. Third-party libraries like
 * @nostrify/react call localStorage.getItem() without guards, causing crashes.
 * This provides an in-memory fallback so the app runs (without persistence).
 */
try {
  // Test both existence and usage — some browsers set localStorage to null,
  // others allow access but throw on use (SecurityError in private mode)
  if (!window.localStorage) throw new Error('localStorage is null');
  window.localStorage.getItem('__storage_test__');
} catch {
  const memoryStorage: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => memoryStorage[key] ?? null,
      setItem: (key: string, value: string) => { memoryStorage[key] = String(value); },
      removeItem: (key: string) => { delete memoryStorage[key]; },
      clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); },
      get length() { return Object.keys(memoryStorage).length; },
      key: (index: number) => Object.keys(memoryStorage)[index] ?? null,
    },
    writable: true,
  });
}

/**
 * Polyfill for AbortSignal.any()
 * 
 * AbortSignal.any() creates an AbortSignal that will be aborted when any of the
 * provided signals are aborted. This is useful for combining multiple abort signals.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static
 */

// Check if AbortSignal.any is already available
if (!AbortSignal.any) {
  AbortSignal.any = function(signals: AbortSignal[]): AbortSignal {
    // If no signals provided, return a signal that never aborts
    if (signals.length === 0) {
      return new AbortController().signal;
    }

    // If only one signal, return it directly for efficiency
    if (signals.length === 1) {
      return signals[0];
    }

    // Check if any signal is already aborted
    for (const signal of signals) {
      if (signal.aborted) {
        // Create an already-aborted signal with the same reason
        const controller = new AbortController();
        controller.abort(signal.reason);
        return controller.signal;
      }
    }

    // Create a new controller for the combined signal
    const controller = new AbortController();

    // Function to abort the combined signal
    const onAbort = (event: Event) => {
      const target = event.target as AbortSignal;
      controller.abort(target.reason);
    };

    // Listen for abort events on all input signals
    for (const signal of signals) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    // Clean up listeners when the combined signal is aborted
    controller.signal.addEventListener('abort', () => {
      for (const signal of signals) {
        signal.removeEventListener('abort', onAbort);
      }
    }, { once: true });

    return controller.signal;
  };
}

/**
 * Polyfill for AbortSignal.timeout()
 * 
 * AbortSignal.timeout() creates an AbortSignal that will be aborted after a
 * specified number of milliseconds.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
 */

// Check if AbortSignal.timeout is already available
if (!AbortSignal.timeout) {
  AbortSignal.timeout = function(milliseconds: number): AbortSignal {
    const controller = new AbortController();
    
    setTimeout(() => {
      controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    }, milliseconds);
    
    return controller.signal;
  };
}