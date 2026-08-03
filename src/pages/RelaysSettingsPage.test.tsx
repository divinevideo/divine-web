import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RelaysSettingsPage from './RelaysSettingsPage';

const updateConfig = vi.fn();

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      theme: 'system',
      relayUrl: 'wss://relay.divine.video',
      relayUrls: ['wss://relay.divine.video'],
      customRelayUrls: ['wss://custom.example'],
      disabledPresetUrls: [],
    },
    updateConfig,
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

beforeEach(() => {
  updateConfig.mockReset();
  updateConfig.mockImplementation((fn) =>
    fn({
      customRelayUrls: ['wss://custom.example'],
      disabledPresetUrls: [],
    }),
  );
});

describe('RelaysSettingsPage', () => {
  it('renders preset relays with their URLs', () => {
    render(<RelaysSettingsPage />);
    expect(screen.getByText('DVines')).toBeInTheDocument();
    expect(screen.getAllByText('wss://relay.divine.video').length).toBeGreaterThan(0);
  });

  it('renders custom relays', () => {
    render(<RelaysSettingsPage />);
    expect(screen.getByText('wss://custom.example')).toBeInTheDocument();
  });

  it('calls updateConfig with a filter that removes the URL when the trash button is clicked', async () => {
    const user = userEvent.setup();
    render(<RelaysSettingsPage />);
    const customRow = screen.getByText('wss://custom.example').closest('div');
    expect(customRow).not.toBeNull();
    const trashButton = within(customRow as HTMLElement).getByRole('button');
    await user.click(trashButton);
    expect(updateConfig).toHaveBeenCalled();
    const updater = updateConfig.mock.calls[0][0] as (c: {
      customRelayUrls?: string[];
    }) => { customRelayUrls?: string[] };
    const next = updater({ customRelayUrls: ['wss://custom.example'] });
    expect(next.customRelayUrls).toEqual([]);
  });
});
