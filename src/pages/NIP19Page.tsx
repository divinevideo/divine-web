import { useParams, Navigate } from 'react-router-dom';
import { getDirectSearchTarget } from '@/lib/directSearch';
import NotFound from './NotFound';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  const target = getDirectSearchTarget(identifier);
  if (!target) {
    return <NotFound />;
  }

  return <Navigate to={target.path} replace />;
}
