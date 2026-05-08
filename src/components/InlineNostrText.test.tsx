import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { nip19 } from 'nostr-tools';
import { InlineNostrText } from './InlineNostrText';

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: { metadata: { name: 'rabble' } },
    isLoading: false,
  }),
}));

const PUBKEY_HEX = 'a'.repeat(64);
const NPUB = nip19.npubEncode(PUBKEY_HEX);

describe('InlineNostrText', () => {
  it('replaces a bare npub1... with @displayName', () => {
    render(<InlineNostrText text={`hi ${NPUB}!`} />);
    expect(screen.getByText(/@rabble/)).toBeInTheDocument();
  });

  it('still replaces nostr:npub1... with @displayName (regression)', () => {
    render(<InlineNostrText text={`hi nostr:${NPUB}!`} />);
    expect(screen.getByText(/@rabble/)).toBeInTheDocument();
  });

  it('renders plain text when no mention is present', () => {
    render(<InlineNostrText text="hello world" />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('does not match bech32-shaped strings mid-word', () => {
    const { container } = render(<InlineNostrText text={`xxx${NPUB}yyy`} />);
    expect(container.textContent).toBe(`xxx${NPUB}yyy`);
    expect(container.textContent).not.toContain('@rabble');
  });
});
