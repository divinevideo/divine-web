import { Navigate, useParams } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import { useListRouteKind } from '@/hooks/useListRouteKind';
import { buildListPath } from '@/lib/eventRouting';
import ListDetailPage from '@/pages/ListDetailPage';
import PeopleListDetailPage from '@/pages/PeopleListDetailPage';

function ListRouteLoadingState() {
  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}

export function LegacyPeopleListRedirect() {
  const { pubkey, listId } = useParams<{ pubkey: string; listId: string }>();

  if (!pubkey || !listId) {
    return <Navigate to="/lists" replace />;
  }

  return <Navigate to={buildListPath(pubkey, listId)} replace />;
}

export default function ListRoutePage() {
  const { pubkey, listId } = useParams<{ pubkey: string; listId: string }>();
  const routeKind = useListRouteKind(pubkey, listId);

  if (routeKind.isLoading) {
    return <ListRouteLoadingState />;
  }

  if (routeKind.data === 'people') {
    return <PeopleListDetailPage />;
  }

  return <ListDetailPage />;
}
