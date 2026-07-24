// ABOUTME: Public single-video landing in showcase mode — the target of shared links
// ABOUTME: One video in a phone frame, download CTAs, safety-gated; no app shell, no login

import { useParams, Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ShareNetwork } from '@phosphor-icons/react';

import { MarketingLayout } from '@/components/MarketingLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { DownloadRow } from '@/components/DownloadRow';
import { PhoneFrame } from '@/components/showcase/PhoneFrame';
import { useShowcaseVideo } from '@/hooks/useShowcaseVideo';
import { useAuthor } from '@/hooks/useAuthor';
import { useShowcaseShare } from '@/hooks/useShowcaseShare';
import { getVideoShareData } from '@/lib/shareUtils';
import { resolveDisplayName } from '@/lib/showcaseDisplayName';
import { getSafeProfileImage } from '@/lib/imageUtils';

export default function ShowcaseVideoPage() {
  const { id } = useParams<{ id: string }>();
  const { data: video, isLoading } = useShowcaseVideo(id);
  const author = useAuthor(video?.pubkey);
  const share = useShowcaseShare();

  const metadata = author.data?.metadata;
  const displayName = video
    ? resolveDisplayName(metadata, video.pubkey, video.authorName)
    : '';
  const avatar = getSafeProfileImage(metadata?.picture ?? video?.authorAvatar);

  useSeoMeta({
    title: video?.title ? `${video.title} · Divine` : 'Divine',
    description: video?.title
      ? `Watch "${video.title}" on Divine — short video on an open protocol.`
      : 'Short video on an open protocol.',
  });

  return (
    <MarketingLayout>
      <main className="container mx-auto px-4 py-10 sm:py-12">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          {/* Video */}
          <div className="order-1 flex justify-center">
            <PhoneFrame>
              {isLoading && <Skeleton className="h-full w-full rounded-none" />}
              {!isLoading && video && (
                <video
                  src={video.videoUrl}
                  poster={video.thumbnailUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                />
              )}
              {!isLoading && !video && (
                <div className="flex h-full w-full items-center justify-center bg-brand-dark-green p-6 text-center">
                  <p className="text-sm text-brand-off-white/80">
                    This clip isn't available here. It may live only in the app.
                  </p>
                </div>
              )}
            </PhoneFrame>
          </div>

          {/* Details + CTAs */}
          <div className="order-2">
            {video && (
              <>
                <div className="flex items-center gap-2">
                  {avatar && (
                    <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                  )}
                  <span className="font-semibold text-brand-dark-green dark:text-brand-off-white">
                    {displayName}
                  </span>
                </div>
                {video.title && (
                  <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-brand-dark-green dark:text-brand-off-white text-balance">
                    {video.title}
                  </h1>
                )}
                <button
                  type="button"
                  onClick={() => share(getVideoShareData(video))}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
                >
                  <ShareNetwork className="h-4 w-4" weight="bold" />
                  Share
                </button>
              </>
            )}

            <div className="mt-8">
              <p className="mb-3 text-base text-muted-foreground text-pretty">
                This is a taste. Following, posting, and joining in all happen in the app.
              </p>
              <DownloadRow campaign="video_share" medium="video_share" />
            </div>

            <Link
              to="/"
              className="mt-6 inline-block text-sm font-medium text-brand-dark-green underline underline-offset-4 dark:text-brand-green"
            >
              ← More looping on Divine
            </Link>
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}
