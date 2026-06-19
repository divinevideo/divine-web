// Behavior coverage: smoke test that NostrProvider renders with the
// relayHealth module wired up, and that pickTopN is exported and callable
// with the expected signature. Full pickTopN / score / sticky behavior
// is covered in relayHealth.test.ts; full reqRouter behavior is exercised
// in the manual smoke test described in the plan.

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as relayHealth from '@/lib/relayHealth';
import NostrProvider from './NostrProvider';

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      theme: 'system',
      relayUrl: 'wss://relay.divine.video',
      relayUrls: ['wss://relay.divine.video', 'wss://relay.damus.io'],
      customRelayUrls: ['wss://custom.example'],
      disabledPresetUrls: [],
    },
    presetRelays: [
      { name: 'DVines', url: 'wss://relay.divine.video' },
      { name: 'Damus', url: 'wss://relay.damus.io' },
    ],
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ resetQueries: vi.fn() }),
}));

describe('NostrProvider', () => {
  it('renders without error when relayHealth is wired up', () => {
    const { container } = render(
      <NostrProvider>
        <div data-testid="child" />
      </NostrProvider>,
    );
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });

  it('exposes pickTopN with the expected arity for the integration', () => {
    // The router passes (urls, n, kind?) to pickTopN. Verify the export
    // accepts this signature by calling it directly.
    const result = relayHealth.pickTopN(
      ['wss://relay.divine.video', 'wss://relay.damus.io'],
      2,
      34236,
    );
    expect(Array.isArray(result)).toBe(true);
  });
});
