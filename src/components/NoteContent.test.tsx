import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { NoteContent } from './NoteContent';
import type { NostrEvent } from '@nostrify/nostrify';

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: { metadata: { name: 'rabble' } },
    isLoading: false,
  }),
}));

const PUBKEY_HEX = 'a'.repeat(64);
const NPUB = nip19.npubEncode(PUBKEY_HEX);
const NOTE = nip19.noteEncode('b'.repeat(64));
const NEVENT = nip19.neventEncode({ id: 'c'.repeat(64) });
const NADDR = nip19.naddrEncode({ kind: 34236, pubkey: PUBKEY_HEX, identifier: 'video-id' });
const NPROFILE = nip19.nprofileEncode({ pubkey: PUBKEY_HEX });

function makeEvent(content: string): NostrEvent {
  return {
    id: '0'.repeat(64),
    pubkey: '1'.repeat(64),
    created_at: 0,
    kind: 1,
    tags: [],
    content,
    sig: '0'.repeat(128),
  };
}

function renderContent(content: string) {
  return render(
    <MemoryRouter>
      <NoteContent event={makeEvent(content)} />
    </MemoryRouter>,
  );
}

describe('NoteContent — bare nostr identifiers', () => {
  it('linkifies a bare npub1... as @mention', () => {
    renderContent(`hello ${NPUB}`);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/${NPUB}`);
    expect(link.textContent).toBe('@rabble');
  });

  it('linkifies a bare note1...', () => {
    renderContent(`see ${NOTE}`);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/${NOTE}`);
    expect(link.textContent).toBe(NOTE);
  });

  it('linkifies a bare nevent1...', () => {
    renderContent(`watch ${NEVENT}`);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/${NEVENT}`);
  });

  it('linkifies a bare naddr1...', () => {
    renderContent(`open ${NADDR}`);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/${NADDR}`);
  });

  it('linkifies a bare nprofile1...', () => {
    renderContent(`hi ${NPROFILE}`);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/${NPROFILE}`);
  });
});

describe('NoteContent — prefixed nostr: form (regression)', () => {
  it('still linkifies nostr:npub1... as @mention', () => {
    renderContent(`hello nostr:${NPUB}`);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/${NPUB}`);
    expect(link.textContent).toBe('@rabble');
  });

  it('still linkifies nostr:note1...', () => {
    renderContent(`see nostr:${NOTE}`);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/${NOTE}`);
  });
});

describe('NoteContent — non-matches', () => {
  it('does not linkify a bech32-shaped id mid-word', () => {
    renderContent(`xxx${NPUB}yyy`);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not linkify obviously invalid bech32', () => {
    renderContent('npub1notvalid');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('still linkifies URLs', () => {
    renderContent('check https://example.com out');
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('still linkifies hashtags', () => {
    renderContent('check #skating out');
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/t/skating');
  });
});
