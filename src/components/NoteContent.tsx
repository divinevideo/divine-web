import { useMemo } from 'react';
import { type NostrEvent } from '@nostrify/nostrify';
import { SmartLink } from '@/components/SmartLink';
import { NostrMention } from '@/components/NostrMention';
import { NOSTR_REFERENCE_PATTERN, parseNostrReferences } from '@/lib/nostrReferences';
import { cn } from '@/lib/utils';

interface NoteContentProps {
  event: NostrEvent;
  className?: string;
  linkifyBareDomains?: boolean;
}

/** Parses content of text note events so that URLs and hashtags are linkified. */
export function NoteContent({
  event, 
  className, 
  linkifyBareDomains = false,
}: NoteContentProps) {  
  // Process the content to render mentions, links, etc.
  const content = useMemo(() => {
    const text = event.content;
    
    // Bounded by DNS limits (63-character labels, 127 labels).
    const domainLabel = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
    // A bare domain starts only at the beginning of the text or after a character
    // that cannot continue a token (not an email's domain or foo_bar.com). Matching
    // that character, rather than a lookbehind, which Safari before 16.4 rejects,
    // keeps attempts from starting inside a long run, which would rescan it from
    // every position. `#` stays out so `#divine.video` remains a hashtag.
    const bareDomain = linkifyBareDomains
      ? `(^|[^\\w@./:#-])(${domainLabel}(?:\\.${domainLabel}){0,126}\\.[A-Za-z]{2,63}(?![\\w@-])(?:[/?#][^\\s]*)?)`
      : '(?!)()()';
    const regex = new RegExp(`(https?:\\/\\/[^\\s]+)|${bareDomain}|(${NOSTR_REFERENCE_PATTERN})|(#\\w+)`, 'gi');

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyCounter = 0;

    while ((match = regex.exec(text)) !== null) {
      const [matched, url, bareBoundary = '', bareUrl, nostrId, hashtag] = match;
      // The boundary character before a bare domain stays plain text.
      const index = match.index + bareBoundary.length;
      const fullMatch = matched.slice(bareBoundary.length);
      
      // Add text before this match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }
      
      if (url || bareUrl) {
        // Handle URLs
        const linkText = bareUrl ? fullMatch.replace(/[.,!?;:)}\]]+$/, '') : fullMatch;
        parts.push(
          <a 
            key={`url-${keyCounter++}`}
            href={url ? linkText : `https://${linkText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {linkText}
          </a>
        );
        if (linkText.length < fullMatch.length) {
          parts.push(fullMatch.slice(linkText.length));
        }
      } else if (nostrId) {
        const references = parseNostrReferences(nostrId);
        if (references.length > 0) {
          for (const reference of references) {
            parts.push(reference.pubkey ? (
              <NostrMention key={`mention-${keyCounter++}`} pubkey={reference.pubkey} />
            ) : (
              <SmartLink
                key={`nostr-${keyCounter++}`}
                to={`/${reference.identifier}`}
                className="text-blue-500 hover:underline"
              >
                {fullMatch.slice(reference.start, reference.end)}
              </SmartLink>
            ));
          }
          lastIndex = index + references[references.length - 1].end;
          regex.lastIndex = lastIndex;
          continue;
        }
        parts.push(fullMatch);
      } else if (hashtag) {
        // Handle hashtags
        const tag = hashtag.slice(1); // Remove the #
        const normalized = tag.toLowerCase();
        parts.push(
          <SmartLink
            key={`hashtag-${keyCounter++}`}
            to={`/t/${normalized}`}
            className="text-blue-500 hover:underline"
          >
            {hashtag}
          </SmartLink>
        );
      }
      
      lastIndex = index + fullMatch.length;
    }
    
    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    // If no special content was found, just use the plain text
    if (parts.length === 0) {
      parts.push(text);
    }
    
    return parts;
  }, [event, linkifyBareDomains]);

  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {content.length > 0 ? content : event.content}
    </div>
  );
}
