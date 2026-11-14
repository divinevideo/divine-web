import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { createRoutesFromChildren, matchRoutes, MemoryRouter, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

import { SentryRoutes } from './SentryRoutes';

function Next() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/video/synthetic')}>Next page</button>;
}
afterEach(async () => { await Sentry.close(); });

it('instruments navigation when imported before SDK initialization, as at app startup', async () => {
  const transactions = vi.fn();
  Sentry.init({
    dsn: 'https://public@example.invalid/1', tracesSampleRate: 1,
    integrations: [Sentry.reactRouterV6BrowserTracingIntegration({ useEffect, useLocation, useNavigationType, createRoutesFromChildren, matchRoutes, idleTimeout: 50 })],
    transport: () => ({ send: async () => ({ statusCode: 200 }), flush: async () => true }),
    beforeSendTransaction: event => { transactions(event); return null; },
  });
  render(<MemoryRouter initialEntries={['/']}><SentryRoutes>
    <Route path="/" element={<Next />} />
    <Route path="/video/:id" element={<h1>Video ready</h1>} />
  </SentryRoutes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByRole('heading', { name: 'Video ready' });
  await waitFor(() => expect(transactions.mock.calls.some(([event]) => event.transaction === '/video/:id' && event.contexts.trace.op === 'navigation')).toBe(true), { timeout: 4000 });
});
