import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { ParsedVideoData } from '@/types/video';

export function useIsOwnVideo(video?: ParsedVideoData): boolean {
  const { user } = useCurrentUser();

  if (!user?.pubkey || !video) return false;

  return user.pubkey === video.pubkey;
}
