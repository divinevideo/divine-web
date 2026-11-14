import { useMemo } from 'react';

import { NostrMention } from '@/components/NostrMention';
import { SmartLink } from '@/components/SmartLink';
import { NOSTR_REFERENCE_PATTERN, parseNostrReferences } from '@/lib/nostrReferences';

interface InlineNostrTextProps {
  text: string;
  textLinkTo?: string;
  textLinkOwnerPubkey?: string | null;
  textLinkClassName?: string;
}

export function InlineNostrText({ text, textLinkTo, textLinkOwnerPubkey, textLinkClassName }: InlineNostrTextProps) {
  const parts = useMemo(() => {
    const result: { text: string; pubkey?: string }[] = [];
    const regex = new RegExp(`https?:\\/\\/[^\\s]+|(${NOSTR_REFERENCE_PATTERN})`, 'gi');
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (!match[1]) continue;
      const references = parseNostrReferences(match[1]);
      for (const reference of references) {
        // Titles link profiles only; any other reference stays in the surrounding text.
        if (!reference.pubkey) continue;
        const start = match.index + reference.start;
        if (start > lastIndex) {
          result.push({ text: text.slice(lastIndex, start) });
        }
        result.push({ text: '', pubkey: reference.pubkey });
        lastIndex = match.index + reference.end;
      }
      if (references.length > 0) {
        regex.lastIndex = match.index + references[references.length - 1].end;
      }
    }
    if (lastIndex < text.length || result.length === 0) {
      result.push({ text: text.slice(lastIndex) });
    }
    return result;
  }, [text]);

  return (
    <>
      {parts.map((part, index) => {
        if (part.pubkey) return <NostrMention key={index} pubkey={part.pubkey} />;
        if (!textLinkTo || part.text.trim() === '') return <span key={index}>{part.text}</span>;
        return (
          <SmartLink key={index} to={textLinkTo} ownerPubkey={textLinkOwnerPubkey} className={textLinkClassName}>
            {part.text}
          </SmartLink>
        );
      })}
    </>
  );
}
