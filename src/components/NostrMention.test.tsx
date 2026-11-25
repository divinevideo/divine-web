import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

import { NoteContent } from '@/components/NoteContent';
import { InlineNostrText } from '@/components/InlineNostrText';
import { genUserName } from '@/lib/genUserName';

const mocks = vi.hoisted(() => ({
  metadata: {} as { name?: string; display_name?: string; nip05?: string },
  validationState: 'valid',
  validationCalls: [] as [string | undefined, string][],
  mentionedPubkey: 'a'.repeat(64),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({ data: { metadata: mocks.metadata }, isLoading: false }),
}));

vi.mock('@/hooks/useNip05Validation', () => ({
  // Only the mentioned user's own nip05, checked against their own pubkey, can validate.
  useNip05Validation: (nip05: string | undefined, pubkey: string) => {
    mocks.validationCalls.push([nip05, pubkey]);
    const matches = nip05 === mocks.metadata.nip05 && pubkey === mocks.mentionedPubkey;
    return { state: matches ? mocks.validationState : 'idle' };
  },
}));

const PUBKEY = 'a'.repeat(64);
const NPUB = nip19.npubEncode(PUBKEY);
const NPROFILE = nip19.nprofileEncode({ pubkey: PUBKEY, relays: ['wss://relay.example.com'] });
const event = { id: 'b'.repeat(64), pubkey: PUBKEY, created_at: 0, kind: 1, tags: [], sig: '0'.repeat(128), content: '' };

function Content({ renderer, text }: { renderer: string; text: string }) {
  return (
    <MemoryRouter>
      {renderer === 'description'
        ? <NoteContent event={{ ...event, content: text }} linkifyBareDomains />
        : <InlineNostrText text={text} />}
    </MemoryRouter>
  );
}

beforeEach(() => {
  mocks.metadata = { name: 'alice', display_name: 'Alice', nip05: '_@alice.divine.video' };
  mocks.validationState = 'valid';
  mocks.validationCalls = [];
});

describe.each(['title', 'description'])('%s profile mentions', (renderer) => {
  it.each([
    ['_@alice.divine.video', '@alice.divine.video', '/u/alice'],
    ['alice@divine.video', '@alice.divine.video', '/u/alice'],
    ['alice@example.com', '@alice@example.com', '/u/alice.example.com'],
    ['_@example.com', '@example.com', '/u/example.com'],
  ])('shows verified %s as %s', (nip05, label, path) => {
    mocks.metadata.nip05 = nip05;
    render(<Content renderer={renderer} text={`hello ${NPUB}`} />);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', path);
  });

  it('preserves the surrounding text style for title mentions', () => {
    render(<Content renderer={renderer} text={NPUB} />);
    const link = screen.getByRole('link', { name: '@alice.divine.video' });
    if (renderer === 'title') {
      expect(link).toHaveAttribute('class', 'hover:underline');
    } else {
      expect(link).toHaveClass('font-medium', 'text-blue-500');
    }
  });

  it('keeps the heading style for title mentions of unnamed accounts', () => {
    mocks.metadata = {};
    mocks.validationState = 'idle';
    render(<Content renderer={renderer} text={NPUB} />);
    const link = screen.getByRole('link', { name: `@${genUserName(PUBKEY)}` });
    if (renderer === 'title') {
      expect(link).toHaveAttribute('class', 'hover:underline');
    } else {
      expect(link).toHaveClass('text-gray-500');
    }
  });

  it.each([NPUB, NPROFILE, `nostr:${NPUB}`, `nostr:${NPROFILE}`, `NOSTR:${NPUB.toUpperCase()}`])('resolves bare and prefixed profile formats', (reference) => {
    render(<Content renderer={renderer} text={`hello ${reference}!`} />);
    expect(screen.getByRole('link', { name: '@alice.divine.video' })).toHaveAttribute('href', '/u/alice');
  });

  it('updates the label and destination only after validation succeeds', () => {
    mocks.validationState = 'loading';
    const { rerender } = render(<Content renderer={renderer} text={NPUB} />);
    expect(screen.getByRole('link', { name: '@Alice' })).toHaveAttribute('href', `/${NPUB}`);
    mocks.validationState = 'valid';
    rerender(<Content renderer={renderer} text={NPUB} />);
    expect(screen.getByRole('link', { name: '@alice.divine.video' })).toHaveAttribute('href', '/u/alice');
    mocks.validationState = 'invalid';
    rerender(<Content renderer={renderer} text={NPUB} />);
    expect(screen.getByRole('link', { name: '@Alice' })).toHaveAttribute('href', `/${NPUB}`);
  });

  it.each(['invalid', 'idle', 'loading'])('does not display an unverified handle while %s', (state) => {
    mocks.validationState = state;
    render(<Content renderer={renderer} text={NPROFILE} />);
    expect(screen.getByRole('link', { name: '@Alice' })).toHaveAttribute('href', `/${NPUB}`);
  });

  it.each([' _@alice.divine.video', '_@Alice.Divine.Video'])('validates %j as published, the same value profile links validate', (nip05) => {
    mocks.metadata.nip05 = nip05;
    mocks.validationState = 'invalid';
    render(<Content renderer={renderer} text={NPUB} />);
    expect(mocks.validationCalls).toContainEqual([nip05, PUBKEY]);
    expect(mocks.validationCalls).not.toContainEqual(['_@alice.divine.video', PUBKEY]);
    expect(screen.getByRole('link', { name: '@Alice' })).toHaveAttribute('href', `/${NPUB}`);
  });

  it('keeps a generated name when profile metadata is absent', () => {
    mocks.metadata = {};
    mocks.validationState = 'idle';
    render(<Content renderer={renderer} text={NPUB} />);
    expect(screen.getByRole('link', { name: `@${genUserName(PUBKEY)}` })).toHaveAttribute('href', `/${NPUB}`);
  });

  it.each([
    [`wnostr:${NPUB}ne`, 'w@alice.divine.videone'],
    [`nostr:${NPUB}and more`, '@alice.divine.videoand more'],
    [`nostr:${NPUB}with`, '@alice.divine.videowith'],
    [`nostr:${NPUB}is`, '@alice.divine.videois'],
    [`nostr:${NPUB}andmore`, '@alice.divine.videoandmore'],
    [`nostr:${NPROFILE}with`, '@alice.divine.videowith'],
    [`${NPUB}s`, '@alice.divine.videos'],
    [`nostr:${NPROFILE}ne`, '@alice.divine.videone'],
    [`(${NPUB}),`, '(@alice.divine.video),'],
    [`${NPUB.toUpperCase()}s`, '@alice.divine.videos'],
  ])('recovers a valid reference and preserves surrounding text', (text, expected) => {
    const { container } = render(<Content renderer={renderer} text={text} />);
    expect(screen.getByRole('link', { name: '@alice.divine.video' })).toHaveAttribute('href', '/u/alice');
    expect(container.textContent).toBe(expected);
  });

  it('keeps a mention of the subdomain owner on their own site', () => {
    window.__DIVINE_USER__ = {
      subdomain: 'alice', pubkey: PUBKEY, npub: NPUB, username: 'alice', displayName: 'Alice',
      picture: null, banner: null, about: null, nip05: '_@alice.divine.video',
      followersCount: 0, followingCount: 0, videoCount: 0, apexDomain: 'divine.video',
    };
    try {
      render(<Content renderer={renderer} text={NPROFILE} />);
      expect(screen.getByRole('link', { name: '@alice.divine.video' })).toHaveAttribute('href', '/u/alice');
    } finally {
      delete window.__DIVINE_USER__;
    }
  });

  it.each([
    `nostr:${NPUB}nostr:${NPUB}`,
    `nostr:${NPROFILE}nostr:${NPUB}`,
    `${NPUB}${NPUB}`,
    `nostr:${NPUB}${NPROFILE}`,
    `nostr:${NPROFILE}${NPUB}`,
  ])('keeps adjacent references as separate links', (text) => {
    const { container } = render(<Content renderer={renderer} text={text} />);
    expect(screen.getAllByRole('link', { name: '@alice.divine.video' })).toHaveLength(2);
    expect(container.textContent).toBe('@alice.divine.video@alice.divine.video');
  });

  it.each([
    `xxx${NPUB}yyy`,
    `${NPUB}_suffix`,
    `nostr:${NPUB.slice(0, -6)}qqqqqqs`,
    `nostr:${NPROFILE}sssss`,
    `nostr:${NPUB.slice(0, 10)}${NPUB.slice(10).toUpperCase()}`,
    `nostr:${NPROFILE.slice(0, 9).toUpperCase()}${NPROFILE.slice(9)}`,
    `nostr:${nip19.npubEncode('a'.repeat(40))}`,
    `nostr:${nip19.nprofileEncode({ pubkey: 'a'.repeat(40) })}`,
    `nostr:${nip19.noteEncode('a'.repeat(40))}`,
    `nostr:${nip19.neventEncode({ id: 'a'.repeat(40) })}`,
    `nostr:${nip19.naddrEncode({ kind: 34236, pubkey: 'a'.repeat(40), identifier: 'invalid' })}`,
  ])('leaves invalid or embedded bare references unchanged', (text) => {
    const { container } = render(<Content renderer={renderer} text={text} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.textContent).toBe(text);
  });
});

describe('description non-profile references', () => {
  it.each([
    nip19.noteEncode('c'.repeat(64)),
    nip19.neventEncode({ id: 'd'.repeat(64) }),
    nip19.naddrEncode({ kind: 34236, pubkey: PUBKEY, identifier: 'synthetic-video' }),
  ])('links a valid reference with attached text without changing the destination', (reference) => {
    const { container } = render(<Content renderer="description" text={`see nostr:${reference}ne!`} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', `/${reference}`);
    expect(screen.getByRole('link')).toHaveTextContent(`nostr:${reference}`);
    expect(container.textContent).toBe(`see nostr:${reference}ne!`);
  });

  it.each([
    [nip19.noteEncode('c'.repeat(64)), 'nostr:'],
    [nip19.neventEncode({ id: 'd'.repeat(64) }), 'nostr:'],
    [nip19.naddrEncode({ kind: 34236, pubkey: PUBKEY, identifier: 'synthetic-video' }), 'nostr:'],
    [nip19.noteEncode('c'.repeat(64)), ''],
    [nip19.neventEncode({ id: 'd'.repeat(64) }), ''],
    [nip19.naddrEncode({ kind: 34236, pubkey: PUBKEY, identifier: 'synthetic-video' }), ''],
  ])('keeps a non-profile reference followed by a profile reference', (reference, separator) => {
    render(<Content renderer="description" text={`nostr:${reference}${separator}${NPUB}`} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByRole('link', { name: `nostr:${reference}` })).toHaveAttribute('href', `/${reference}`);
    expect(screen.getByRole('link', { name: '@alice.divine.video' })).toHaveAttribute('href', '/u/alice');
  });

  it('preserves URL precedence over Nostr parsing', () => {
    const url = `https://example.com/${NPUB}`;
    render(<Content renderer="description" text={url} />);
    expect(screen.getByRole('link', { name: url })).toHaveAttribute('href', url);
  });
});

describe('title non-profile references', () => {
  it('keeps a non-profile reference as text before a glued profile reference', () => {
    const note = nip19.noteEncode('c'.repeat(64));
    const { container } = render(<Content renderer="title" text={`nostr:${note}${NPUB}`} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '@alice.divine.video' })).toHaveAttribute('href', '/u/alice');
    expect(container.textContent).toBe(`nostr:${note}@alice.divine.video`);
  });
});
