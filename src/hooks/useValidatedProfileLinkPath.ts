import { useNip05Validation } from '@/hooks/useNip05Validation';
import { buildProfileLinkPath, type ProfileFallbackRoute } from '@/lib/profileLinks';

interface UseValidatedProfileLinkPathInput {
  pubkey: string;
  nip05?: string;
  fallbackRoute?: ProfileFallbackRoute;
}

export function useValidatedProfileLinkPath({
  pubkey,
  nip05,
  fallbackRoute,
}: UseValidatedProfileLinkPathInput): string {
  const { state } = useNip05Validation(nip05, pubkey);

  return buildProfileLinkPath({
    pubkey,
    nip05: state === 'valid' ? nip05 : undefined,
    fallbackRoute,
  });
}
