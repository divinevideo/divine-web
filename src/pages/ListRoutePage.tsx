import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import { useListRouteKind } from '@/hooks/useListRouteKind';
import {
  LIST_KIND_PARAM,
  PEOPLE_LIST_EVENT_KIND,
  buildListPath,
  parseListKindParam,
} from '@/lib/eventRouting';
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

  return <Navigate to={buildListPath(pubkey, listId, PEOPLE_LIST_EVENT_KIND)} replace />;
}

export default function ListRoutePage() {
  const { pubkey, listId } = useParams<{ pubkey: string; listId: string }>();
  const [searchParams] = useSearchParams();
  const pinnedKind = parseListKindParam(searchParams.get(LIST_KIND_PARAM));
  const routeKind = useListRouteKind(pubkey, listId, { enabled: pinnedKind === null });

  if (pinnedKind !== null) {
    return pinnedKind === PEOPLE_LIST_EVENT_KIND ? <PeopleListDetailPage /> : <ListDetailPage />;
  }

  if (routeKind.isLoading) {
    return <ListRouteLoadingState />;
  }

  if (routeKind.data === 'people') {
    return <PeopleListDetailPage />;
  }

  return <ListDetailPage />;
}
