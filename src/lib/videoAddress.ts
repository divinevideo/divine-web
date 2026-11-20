import { isAddressableKind } from 'nostr-tools/kinds';

import type { ParsedVideoData } from '@/types/video';

type AddressableVideoFields = Pick<ParsedVideoData, 'pubkey' | 'kind' | 'vineId' | 'id'>;

export function videoAddress(video: AddressableVideoFields): string {
  return isAddressableKind(video.kind) && video.vineId
    ? `${video.pubkey}:${video.kind}:${video.vineId}`
    : video.id;
}
