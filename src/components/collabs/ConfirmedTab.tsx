import { useMyConfirmedCollabs } from '@/hooks/useMyConfirmedCollabs';
import { VideoCard } from '@/components/VideoCard';
import { transformFunnelcakeVideo } from '@/lib/funnelcakeTransform';

export function ConfirmedTab() {
  const { data, isPending, isError } = useMyConfirmedCollabs();

  if (isPending) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-video animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }
  if (isError) return <div className="text-destructive">Couldn't load.</div>;
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border p-6 text-center text-muted-foreground">
        No confirmed collabs yet. Once you approve an invite, it'll show up here.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {data.map((raw) => (
        <VideoCard key={raw.id} video={transformFunnelcakeVideo(raw)} />
      ))}
    </div>
  );
}
