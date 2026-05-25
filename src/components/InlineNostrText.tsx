import { useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { SmartLink } from '@/components/SmartLink';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

const NIP19_CHARS = '023456789acdefghjklmnpqrstuvwxyz';
const NOSTR_MENTION_REGEX = new RegExp(`(?:nostr:)?\\b(npub1[${NIP19_CHARS}]{58})(?=$|[^A-Za-z0-9_]|nostr:)`, 'g');

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
  const npub = nip19.npubEncode(pubkey);
  const displayName = author.data?.metadata?.name || author.data?.metadata?.display_name || genUserName(pubkey);

  return (
    <SmartLink to={`/${npub}`} ownerPubkey={pubkey} className="hover:underline">
      @{displayName}
    </SmartLink>
  );
}

interface InlineNostrTextProps {
  text: string;
  textLinkTo?: string;
  textLinkOwnerPubkey?: string | null;
  textLinkClassName?: string;
}

export function InlineNostrText({ text, textLinkTo, textLinkOwnerPubkey, textLinkClassName }: InlineNostrTextProps) {
  const pubkeys = useMemo(() => extractPubkeys(text), [text]);

  if (pubkeys.length === 0) {
    return <TextPart text={text} linkTo={textLinkTo} ownerPubkey={textLinkOwnerPubkey} className={textLinkClassName} />;
  }

  return <InlineNostrTextResolved text={text} textLinkTo={textLinkTo} textLinkOwnerPubkey={textLinkOwnerPubkey} textLinkClassName={textLinkClassName} />;
}

function TextPart({ text, linkTo, ownerPubkey, className }: { text: string; linkTo?: string; ownerPubkey?: string | null; className?: string }) {
  if (!linkTo || text.trim() === '') {
    return <span>{text}</span>;
  }

  return (
    <SmartLink to={linkTo} ownerPubkey={ownerPubkey} className={className}>
      {text}
    </SmartLink>
  );
}

function InlineNostrTextResolved({ text, textLinkTo, textLinkOwnerPubkey, textLinkClassName }: InlineNostrTextProps) {
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
          <TextPart key={i} text={part.value} linkTo={textLinkTo} ownerPubkey={textLinkOwnerPubkey} className={textLinkClassName} />
        )
      )}
    </>
  );
}
