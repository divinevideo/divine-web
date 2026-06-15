import type { ReactNode } from 'react';
import { SmartLink } from '@/components/SmartLink';

const PROFILE_BIO_TOKEN_REGEX = /(https?:\/\/[^\s]+)|(\b[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?)|(nostr:(?:npub1|note1|nprofile1|nevent1)[023456789acdefghjklmnpqrstuvwxyz]+)|(#([A-Za-z_][A-Za-z0-9_]*))/g;

function trimUrlPunctuation(input: string): { value: string; suffix: string } {
  let value = input;
  let suffix = '';

  while (value.length > 0 && /[),.!?]$/.test(value)) {
    suffix = value.slice(-1) + suffix;
    value = value.slice(0, -1);
  }

  return { value, suffix };
}

export function normalizeExternalUrl(input: string | undefined): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function linkifyProfileBioText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;
  let match: RegExpExecArray | null;

  while ((match = PROFILE_BIO_TOKEN_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const urlWithProtocol = match[1];
    const bareDomain = match[2];
    const nostrRef = match[3];
    const hashtag = match[4];
    const index = match.index;

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    if (urlWithProtocol || bareDomain) {
      const { value, suffix } = trimUrlPunctuation(fullMatch);
      const href = normalizeExternalUrl(value);

      if (href) {
        parts.push(
          <a
            key={`url-${keyCounter++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {value}
          </a>,
        );
      } else {
        parts.push(value);
      }

      if (suffix) {
        parts.push(suffix);
      }
    } else if (nostrRef) {
      const nostrId = nostrRef.slice('nostr:'.length);
      parts.push(
        <SmartLink
          key={`nostr-${keyCounter++}`}
          to={`/${nostrId}`}
          className="text-primary hover:underline"
        >
          {nostrRef}
        </SmartLink>,
      );
    } else if (hashtag) {
      const normalizedTag = hashtag.slice(1).toLowerCase();
      parts.push(
        <SmartLink
          key={`hashtag-${keyCounter++}`}
          to={`/t/${encodeURIComponent(normalizedTag)}`}
          className="text-primary hover:underline"
        >
          {hashtag}
        </SmartLink>,
      );
    }

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) {
    parts.push(text);
  }

  return parts;
}
