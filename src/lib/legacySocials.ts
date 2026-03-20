export interface LegacySocialLink {
  platform: 'youtube' | 'instagram' | 'twitter' | 'snapchat';
  label: string;
  handle: string;
  url: string;
}

interface LegacySocialInput {
  displayName?: string;
  name?: string;
  about?: string;
  website?: string;
}

const HANDLE_PATTERN = '([A-Za-z0-9._-]+)';

function addLink(
  links: LegacySocialLink[],
  seen: Set<string>,
  link: LegacySocialLink
) {
  const key = `${link.platform}:${link.handle.toLowerCase()}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  links.push(link);
}

function parseYouTube(text: string): string[] {
  const matches = text.match(new RegExp(`youtube\\.com\\/@?${HANDLE_PATTERN}`, 'ig')) ?? [];
  return matches
    .map((match) => match.match(new RegExp(`youtube\\.com\\/@?${HANDLE_PATTERN}`, 'i'))?.[1] ?? '')
    .filter(Boolean);
}

function parseLabeledHandles(text: string, labelPattern: string): string[] {
  const matches = text.matchAll(new RegExp(`(?:^|[\\s/|])${labelPattern}\\s*:\\s*@?${HANDLE_PATTERN}`, 'ig'));
  return Array.from(matches, (match) => match[1] ?? '').filter(Boolean);
}

export function parseLegacySocials(input: LegacySocialInput): LegacySocialLink[] {
  const texts = [
    input.displayName,
    input.name,
    input.about,
    input.website?.includes('divine.video/profile/') ? undefined : input.website,
  ].filter((value): value is string => !!value);

  const links: LegacySocialLink[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    for (const handle of parseYouTube(text)) {
      addLink(links, seen, {
        platform: 'youtube',
        label: 'YouTube',
        handle,
        url: `https://www.youtube.com/@${handle}`,
      });
    }
  }

  for (const text of texts) {
    for (const handle of parseLabeledHandles(text, '(?:insta(?:gram)?|ig)')) {
      addLink(links, seen, {
        platform: 'instagram',
        label: 'Instagram',
        handle,
        url: `https://www.instagram.com/${handle}/`,
      });
    }

    for (const handle of parseLabeledHandles(text, '(?:twitter|x)')) {
      addLink(links, seen, {
        platform: 'twitter',
        label: 'Twitter / X',
        handle,
        url: `https://twitter.com/${handle}`,
      });
    }

    for (const handle of parseLabeledHandles(text, '(?:snapchat|snap)')) {
      addLink(links, seen, {
        platform: 'snapchat',
        label: 'Snapchat',
        handle,
        url: `https://www.snapchat.com/add/${handle}`,
      });
    }
  }

  return links;
}
