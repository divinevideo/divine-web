// ABOUTME: Apple Podcasts embed component for displaying podcast episodes
// ABOUTME: Creates a nice embedded player similar to Slack's podcast embeds

import { ExternalLink, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ApplePodcastEmbedProps {
  episodeUrl: string;
  title?: string;
  description?: string;
  showName?: string;
  duration?: string;
  artworkUrl?: string;
  className?: string;
}

export function ApplePodcastEmbed({
  episodeUrl,
  title = "Vine Revisited and The Fight Against AI Slop",
  description = "Behind the scenes of the diVine launch",
  showName = "Revolution.Social",
  duration = "21 min",
  artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/7f/29/73/7f2973f2-c3c6-bad0-6f29-e78afa22ccca/mza_12880046013239631742.jpeg/300x300bb.webp",
  className = "",
}: ApplePodcastEmbedProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Podcast Artwork - Square on the left */}
          <div className="flex-shrink-0">
            <a
              href={episodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted">
                <img
                  src={artworkUrl}
                  alt={`${showName} podcast artwork`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                      <Play className="h-6 w-6 text-primary-foreground ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                </div>
              </div>
            </a>
          </div>

          {/* Metadata and description */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="h-4 w-4 text-[#F94C57] flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Podcast Episode
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {showName} • {duration}
                </p>
                {description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {description}
                  </p>
                )}
              </div>
              <a
                href={episodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-primary hover:text-brand-green transition-colors"
                aria-label="Open in Apple Podcasts"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            </div>

            {/* Play button */}
            <div className="mt-4">
              <a
                href={episodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:brightness-110 transition-colors text-sm font-medium"
              >
                <Play className="h-4 w-4" fill="currentColor" />
                Play Episode
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ApplePodcastEmbed;
