import { SmartLink } from '@/components/SmartLink';
import { useAuthor } from '@/hooks/useAuthor';
import { useNip05Validation } from '@/hooks/useNip05Validation';
import { useValidatedProfileLinkPath } from '@/hooks/useValidatedProfileLinkPath';
import { getDivineNip05Info } from '@/lib/nip05Utils';
import { resolveDisplayName } from '@/lib/resolveDisplayName';
import { cn } from '@/lib/utils';

interface NostrMentionProps {
  pubkey: string;
}

export function NostrMention({ pubkey }: NostrMentionProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  // Pass nip05 as published, like every other profile link, so they share one validation.
  const nip05 = metadata?.nip05;
  const { state } = useNip05Validation(nip05, pubkey);
  const profilePath = useValidatedProfileLinkPath({ pubkey, nip05 });
  const verifiedNip05 = state === 'valid' ? nip05 : undefined;
  const label = verifiedNip05
    ? getDivineNip05Info(verifiedNip05)?.displayName
      ?? (verifiedNip05.startsWith('_@') ? `@${verifiedNip05.slice(2)}` : `@${verifiedNip05}`)
    : `@${resolveDisplayName(metadata, pubkey)}`;
  const hasIdentity = !!(verifiedNip05 || metadata?.display_name?.trim() || metadata?.name?.trim());

  return (
    <SmartLink
      to={profilePath}
      ownerPubkey={pubkey}
      className={cn(
        'font-medium hover:underline',
        hasIdentity ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700',
      )}
    >
      {label}
    </SmartLink>
  );
}
