import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

function renderInlineText(text: string, props: Omit<React.ComponentProps<typeof InlineNostrText>, 'text'> = {}) {
  return render(
    <MemoryRouter>
      <InlineNostrText text={text} {...props} />
    </MemoryRouter>
  );
}

describe('InlineNostrText', () => {
  it('replaces a bare npub1... with a profile link using the display name', () => {
    renderInlineText(`hi ${NPUB}!`);
    const link = screen.getByRole('link', { name: '@rabble' });
    expect(link).toHaveAttribute('href', `/${NPUB}`);
  });

  it('still replaces nostr:npub1... with a profile link using the display name (regression)', () => {
    renderInlineText(`hi nostr:${NPUB}!`);
    const link = screen.getByRole('link', { name: '@rabble' });
    expect(link).toHaveAttribute('href', `/${NPUB}`);
  });

  it('renders plain text when no mention is present', () => {
    renderInlineText("hello world");
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('links non-mention text to the fallback target when provided', () => {
    renderInlineText('hello world', { textLinkTo: '/video/video-1' });
    expect(screen.getByRole('link', { name: 'hello world' })).toHaveAttribute('href', '/video/video-1');
  });

  it('keeps mention links separate from the fallback text link', () => {
    renderInlineText(`hello ${NPUB}`, { textLinkTo: '/video/video-1' });
    expect(screen.getByRole('link', { name: /hello/ })).toHaveAttribute('href', '/video/video-1');
    expect(screen.getByRole('link', { name: '@rabble' })).toHaveAttribute('href', `/${NPUB}`);
  });

  it('still linkifies npub mentions when they are followed by adjacent nostr text', () => {
    renderInlineText(`hi nostr:${NPUB}nostr:${NPUB}`);
    const links = screen.getAllByRole('link', { name: '@rabble' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', `/${NPUB}`);
    expect(links[1]).toHaveAttribute('href', `/${NPUB}`);
  });

  it('does not match bech32-shaped strings mid-word', () => {
    const { container } = renderInlineText(`xxx${NPUB}yyy`);
    expect(container.textContent).toBe(`xxx${NPUB}yyy`);
    expect(container.textContent).not.toContain('@rabble');
  });

  it('does not match npub strings followed by an underscore word suffix', () => {
    const { container } = renderInlineText(`${NPUB}_suffix`);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.textContent).toBe(`${NPUB}_suffix`);
  });
});
