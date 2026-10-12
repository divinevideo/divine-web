import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

import { linkifyProfileBioText } from './profileBioLinkify';

function renderText(text: string) {
  return render(<MemoryRouter>{linkifyProfileBioText(text)}</MemoryRouter>);
}

describe('linkifyProfileBioText — nostr references', () => {
  it('links a valid nostr: npub mention to the profile route', () => {
    const npub = nip19.npubEncode('c'.repeat(64));

    renderText(`say hi to nostr:${npub}`);

    expect(screen.getByRole('link', { name: `nostr:${npub}` })).toHaveAttribute(
      'href',
      `/${npub}`,
    );
  });

  it('renders a mention with a broken checksum as plain text', () => {
    // Shape of a corrupted archive mention: a stray leading character and an
    // npub two characters too long, so the bech32 checksum fails. Linking it
    // would send the reader to a profile that cannot exist.
    const npub = nip19.npubEncode('c'.repeat(64));
    const corrupted = `wnostr:${npub}st`;

    const { container } = renderText(corrupted);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.textContent).toBe(corrupted);
  });

  it('renders an undecodable note reference as plain text', () => {
    const note = nip19.noteEncode('d'.repeat(64));
    const corrupted = `nostr:${note}zz`;

    const { container } = renderText(corrupted);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.textContent).toBe(corrupted);
  });
});