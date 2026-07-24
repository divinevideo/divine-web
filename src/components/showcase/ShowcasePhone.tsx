// ABOUTME: Presentational phone-frame panel for the showcase reel
// ABOUTME: Renders the loading, populated, and empty states; layout lives in the page

import { PhoneFrame } from '@/components/showcase/PhoneFrame';
import { ShowcaseReel } from '@/components/showcase/ShowcaseReel';
import { Skeleton } from '@/components/ui/skeleton';
import type { ParsedVideoData } from '@/types/video';

interface ShowcasePhoneProps {
  isLoading: boolean;
  isEmpty: boolean;
  videos: ParsedVideoData[];
}

export function ShowcasePhone({ isLoading, isEmpty, videos }: ShowcasePhoneProps) {
  return (
    <PhoneFrame className="mx-0">
      {isLoading && <Skeleton className="h-full w-full rounded-none" />}
      {!isLoading && videos.length > 0 && <ShowcaseReel videos={videos} />}
      {isEmpty && (
        <div className="flex h-full w-full items-center justify-center bg-brand-dark-green p-6 text-center">
          <p className="text-sm text-brand-off-white/80">
            Curated clips will loop here soon.
          </p>
        </div>
      )}
    </PhoneFrame>
  );
}
