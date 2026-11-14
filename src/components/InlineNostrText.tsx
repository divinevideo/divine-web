import { useMemo } from 'react';

import { NostrMention } from '@/components/NostrMention';
import { SmartLink } from '@/components/SmartLink';
import { NOSTR_REFERENCE_PATTERN, parseNostrReference } from '@/lib/nostrReferences';

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
      const reference = parseNostrReference(match[1]);
      if (!reference?.pubkey) continue;
      if (match.index > lastIndex) {
        result.push({ text: text.slice(lastIndex, match.index) });
      }
      result.push({ text: '', pubkey: reference.pubkey });
      lastIndex = match.index + reference.consumedLength;
      regex.lastIndex = lastIndex;
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
