import { useParams, Navigate } from 'react-router-dom';
import { getDirectSearchTarget } from '@/lib/directSearch';
import { AtUsernamePage } from './AtUsernamePage';
import NotFound from './NotFound';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  // Handle @username pattern (e.g., divine.video/@alice)
  if (identifier.startsWith('@') && identifier.length > 1) {
    return <AtUsernamePage username={identifier.slice(1)} />;
  }

  const target = getDirectSearchTarget(identifier);
  if (!target) {
    return <NotFound />;
  }

  return <Navigate to={target.path} replace />;
}
