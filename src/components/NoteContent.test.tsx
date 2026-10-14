import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { NoteContent } from './NoteContent';
import { genUserName } from '@/lib/genUserName';
import type { NostrEvent } from '@nostrify/nostrify';

const noteMocks = vi.hoisted(() => ({
  metadata: { display_name: 'rabble' } as Record<string, unknown>,
  useNip05Validation: vi.fn(),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: { metadata: noteMocks.metadata },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useNip05Validation', () => ({
  useNip05Validation: noteMocks.useNip05Validation,
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

function renderContent(content: string, linkifyBareDomains = false) {
  return render(
    <MemoryRouter>
      <NoteContent event={makeEvent(content)} linkifyBareDomains={linkifyBareDomains} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  noteMocks.metadata = { display_name: 'rabble' };
  noteMocks.useNip05Validation.mockReturnValue({
    isValid: false,
    isLoading: false,
    isInvalid: true,
    state: 'invalid',
    nip05: undefined,
  });
});

describe('NoteContent — bare domains', () => {
  it('links a domain and path when enabled', () => {
    renderContent('check out divine.video/leaderboard', true);

    expect(screen.getByRole('link', { name: 'divine.video/leaderboard' }))
      .toHaveAttribute('href', 'https://divine.video/leaderboard');
  });

  it('keeps a query string while excluding surrounding punctuation', () => {
    renderContent('See (divine.video/leaderboard?tab=weekly&sort=hot).', true);

    expect(screen.getByRole('link', { name: 'divine.video/leaderboard?tab=weekly&sort=hot' }))
      .toHaveAttribute('href', 'https://divine.video/leaderboard?tab=weekly&sort=hot');
    expect(screen.getByText(/\)\.$/)).toBeInTheDocument();
  });

  it('does not link bare domains by default', () => {
    renderContent('check out divine.video/leaderboard');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not link domains inside email addresses or longer words', () => {
    renderContent('mail person@example.com or example.com@evil.com or foo_divine.video', true);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('works where the regex engine has no lookbehind, as in Safari before 16.4', () => {
    const NativeRegExp = globalThis.RegExp;
    vi.stubGlobal('RegExp', new Proxy(NativeRegExp, {
      construct(target, args: [string | RegExp, string?]) {
        if (/\(\?<[=!]/.test(String(args[0]))) {
          throw new SyntaxError('Invalid regular expression: invalid group specifier name');
        }
        return Reflect.construct(target, args);
      },
    }));

    try {
      renderContent('check out divine.video/leaderboard or person@example.com', true);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'divine.video/leaderboard' }))
      .toHaveAttribute('href', 'https://divine.video/leaderboard');
  });

  it('keeps full URLs, hashtags, and Nostr references as distinct links', () => {
    renderContent(`https://example.com/path divine.video/leaderboard #skating ${NOTE}`, true);

    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'https://example.com/path' }))
      .toHaveAttribute('href', 'https://example.com/path');
    expect(screen.getByRole('link', { name: 'divine.video/leaderboard' }))
      .toHaveAttribute('href', 'https://divine.video/leaderboard');
    expect(screen.getByRole('link', { name: '#skating' })).toHaveAttribute('href', '/t/skating');
    expect(screen.getByRole('link', { name: NOTE })).toHaveAttribute('href', `/${NOTE}`);
  });

  it('renders a relay-maximum comment with no spaces without stalling', () => {
    // The relay accepts 100 KB of content. A domain pattern with no length bound
    // rescans the rest of a long run from every position, which took seconds here.
    const started = performance.now();
    renderContent('a'.repeat(102_400), true);

    expect(performance.now() - started).toBeLessThan(1000);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a relay-maximum run of dotted labels that never form a domain without stalling', () => {
    // Every label ends in a digit, so no position yields a top-level domain.
    // Retrying the pattern from inside each label took seconds even with length bounds.
    const started = performance.now();
    renderContent(`${'a'.repeat(62)}1.`.repeat(1600), true);

    expect(performance.now() - started).toBeLessThan(1000);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps a hashtag that runs into a domain as a hashtag', () => {
    renderContent('#divine.video', true);

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '#divine' })).toHaveAttribute('href', '/t/divine');
  });

  it('links a bare domain at the start of a line', () => {
    renderContent('first line\ndivine.video/leaderboard', true);

    expect(screen.getByRole('link', { name: 'divine.video/leaderboard' }))
      .toHaveAttribute('href', 'https://divine.video/leaderboard');
  });
});

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

  it('uses a friendly mention profile link when the NIP-05 is valid', () => {
    noteMocks.metadata = {
      display_name: 'rabble',
      nip05: '_@rabble.divine.video',
    };
    noteMocks.useNip05Validation.mockReturnValue({
      isValid: true,
      isLoading: false,
      isInvalid: false,
      state: 'valid',
      nip05: '_@rabble.divine.video',
    });

    renderContent(`hello ${NPUB}`);

    expect(screen.getByRole('link', { name: '@rabble' })).toHaveAttribute('href', '/u/rabble');
  });

  it('uses the npub mention profile link when the NIP-05 is invalid', () => {
    noteMocks.metadata = {
      display_name: 'rabble',
      nip05: 'rabble@spoofed.example',
    };

    renderContent(`hello ${NPUB}`);

    expect(screen.getByRole('link', { name: '@rabble' })).toHaveAttribute('href', `/${NPUB}`);
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

  it('still linkifies adjacent nostr:npub1... mentions as profile links', () => {
    renderContent(`hello nostr:${NPUB}nostr:${NPUB}`);
    const links = screen.getAllByRole('link', { name: '@rabble' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', `/${NPUB}`);
    expect(links[1]).toHaveAttribute('href', `/${NPUB}`);
  });
});

describe('NoteContent — mention name styling', () => {
  it('styles a whitespace-only profile name as a generated name', () => {
    noteMocks.metadata = { name: '   ' };

    renderContent(`hello ${NPUB}`);

    const link = screen.getByRole('link');
    expect(link.textContent).toBe(`@${genUserName(PUBKEY_HEX)}`);
    expect(link.className).toContain('text-gray-500');
    expect(link.className).not.toContain('text-blue-500');
  });

  it('styles a real profile name as a real name', () => {
    renderContent(`hello ${NPUB}`);

    const link = screen.getByRole('link');
    expect(link.textContent).toBe('@rabble');
    expect(link.className).toContain('text-blue-500');
  });
});

describe('NoteContent — non-matches', () => {
  it('does not linkify a bech32-shaped id mid-word', () => {
    renderContent(`xxx${NPUB}yyy`);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not linkify npub strings followed by an underscore word suffix', () => {
    renderContent(`${NPUB}_suffix`);
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
