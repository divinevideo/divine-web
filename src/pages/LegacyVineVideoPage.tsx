import { useParams, Navigate } from 'react-router-dom';
import { useVideoByIdFunnelcake } from '@/hooks/useVideoByIdFunnelcake';
import { buildVideoPath } from '@/lib/eventRouting';
import NotFound from './NotFound';

export function LegacyVineVideoPage() {
  const { legacyVineId } = useParams<{ legacyVineId: string }>();

  const { video, isLoading } = useVideoByIdFunnelcake({
    videoId: legacyVineId || '',
    enabled: !!legacyVineId,
  });

  if (!legacyVineId) {
    return <NotFound />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Finding this Vine...</div>
      </div>
    );
  }

  if (!video) {
    return <NotFound />;
  }

  return <Navigate to={buildVideoPath(video.id)} replace />;
}
