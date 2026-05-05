// ABOUTME: Discovery card for a NIP-51 video list (kind 30005)
// ABOUTME: Shows a thumbnail tile with play badge, title and description — mirrors PeopleListCard dimensions

import { Link } from 'react-router-dom';
import { Play } from '@phosphor-icons/react';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { buildListPath } from '@/lib/eventRouting';
import type { VideoList } from '@/hooks/useVideoLists';

// ---- constants ---------------------------------------------------------------

const CARD_HEIGHT = 120;
const CARD_WIDTH = 177;

// ---- thumbnail tile ----------------------------------------------------------

interface ThumbnailTileProps {
  image?: string;
  name: string;
  videoCount: number;
}

function ThumbnailTile({ image, name, videoCount }: ThumbnailTileProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg shrink-0 bg-neutral-200 dark:bg-neutral-800"
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
    >
      {image ? (
        <img
          src={image}
          alt={name}
          className="w-full h-full"
          style={{ objectFit: 'cover' }}
          loading="lazy"
          data-testid="video-list-cover-image"
        />
      ) : (
        <div
          data-testid="video-list-cover-placeholder"
          className="w-full h-full flex items-center justify-center"
          style={{ backgroundColor: 'hsl(150, 20%, 80%)' }}
        />
      )}

      {/* Play / video-count badge — bottom-left scrim */}
      <div
        data-testid="video-count-badge"
        className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-white text-xs font-semibold"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      >
        <Play weight="bold" className="h-3.5 w-3.5" />
        {videoCount}
      </div>
    </div>
  );
}

// ---- public component --------------------------------------------------------

export interface VideoListCardProps {
  list: VideoList;
}

export function VideoListCard({ list }: VideoListCardProps) {
  const href = buildListPath(list.pubkey, list.id);

  return (
    <Link
      to={href}
      className="flex flex-col gap-2 rounded-lg overflow-hidden hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark-green"
      aria-label={list.name}
    >
      <ThumbnailTile
        image={list.image}
        name={list.name}
        videoCount={list.videoCoordinates.length}
      />

      {/* Text area */}
      <div className="px-0.5">
        <SectionHeader as="h3" className="text-[14px] leading-snug line-clamp-1">
          {list.name}
        </SectionHeader>

        {list.description && (
          <p
            className="text-[12px] leading-snug line-clamp-2 mt-0.5"
            style={{
              fontFamily: "'Inter Variable', sans-serif",
              opacity: 0.75,
            }}
          >
            {list.description}
          </p>
        )}
      </div>
    </Link>
  );
}
