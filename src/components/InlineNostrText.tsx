// ABOUTME: Renders text with nostr:npub1... references replaced by @displayName
// ABOUTME: Plain text output (no links), safe to use inside <a> tags and titles

import { useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

const NOSTR_MENTION_REGEX = /nostr:(npub1[023456789acdefghjklmnpqrstuvwxyz]+)/g;

/** Extract all npub pubkeys from a text string */
function extractPubkeys(text: string): string[] {
  const pubkeys: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(NOSTR_MENTION_REGEX);
  while ((match = regex.exec(text)) !== null) {
    try {
      const decoded = nip19.decode(match[1]);
      if (decoded.type === 'npub') {
        pubkeys.push(decoded.data);
      }
    } catch {
      // skip invalid npubs
    }
  }
  return pubkeys;
}

/** Resolves a single pubkey to a display name */
function MentionName({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || author.data?.metadata?.display_name || genUserName(pubkey);
  return <>@{displayName}</>;
}

interface InlineNostrTextProps {
  text: string;
}

/**
 * Renders text with nostr:npub1... mentions replaced by @displayName.
 * Does NOT render links — safe to use inside other clickable elements.
 */
export function InlineNostrText({ text }: InlineNostrTextProps) {
  const pubkeys = useMemo(() => extractPubkeys(text), [text]);

  // No mentions — render as plain text (no hooks called conditionally)
  if (pubkeys.length === 0) {
    return <>{text}</>;
  }

  return <InlineNostrTextResolved text={text} />;
}

/** Inner component that renders text with resolved mentions */
function InlineNostrTextResolved({ text }: { text: string }) {
  const parts = useMemo(() => {
    const result: { type: 'text' | 'mention'; value: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(NOSTR_MENTION_REGEX);

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', value: text.substring(lastIndex, match.index) });
      }
      try {
        const decoded = nip19.decode(match[1]);
        if (decoded.type === 'npub') {
          result.push({ type: 'mention', value: decoded.data });
        } else {
          result.push({ type: 'text', value: match[0] });
        }
      } catch {
        result.push({ type: 'text', value: match[0] });
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      result.push({ type: 'text', value: text.substring(lastIndex) });
    }

    return result;
  }, [text]);

  return (
    <>
      {parts.map((part, i) =>
        part.type === 'mention' ? (
          <MentionName key={i} pubkey={part.value} />
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}
