import { SmartLink } from '@/components/SmartLink';
import { useAuthor } from '@/hooks/useAuthor';
import { useNip05Validation } from '@/hooks/useNip05Validation';
import { getDivineNip05Info } from '@/lib/nip05Utils';
import { buildProfileLinkPath } from '@/lib/profileLinks';
import { resolveDisplayName } from '@/lib/resolveDisplayName';
import { cn } from '@/lib/utils';

interface NostrMentionProps {
  pubkey: string;
  className?: string;
}

export function NostrMention({ pubkey, className }: NostrMentionProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const nip05 = metadata?.nip05?.trim();
  const { state } = useNip05Validation(nip05, pubkey);
  const verifiedNip05 = state === 'valid' ? nip05 : undefined;
  const label = verifiedNip05
    ? getDivineNip05Info(verifiedNip05)?.displayName
      ?? (verifiedNip05.startsWith('_@') ? `@${verifiedNip05.slice(2)}` : `@${verifiedNip05}`)
    : `@${resolveDisplayName(metadata, pubkey)}`;
  const hasIdentity = !!(verifiedNip05 || metadata?.display_name?.trim() || metadata?.name?.trim());

  return (
    <SmartLink
      to={buildProfileLinkPath({ pubkey, nip05: verifiedNip05 })}
      ownerPubkey={pubkey}
      className={cn(
        'font-medium hover:underline',
        hasIdentity ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700',
        className,
      )}
    >
      {label}
    </SmartLink>
  );
}
