import type { ParsedVideoData } from '@/types/video';

type AddressableVideoFields = Pick<ParsedVideoData, 'pubkey' | 'kind' | 'vineId' | 'id'>;

export function videoAddress(video: AddressableVideoFields): string {
  return `${video.pubkey}:${video.kind}:${video.vineId || video.id}`;
}
