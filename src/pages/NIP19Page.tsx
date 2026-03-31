import { useParams, Navigate } from 'react-router-dom';
import { getDirectSearchTarget } from '@/lib/directSearch';
import { AtUsernamePage } from './AtUsernamePage';
import NotFound from './NotFound';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  // Handle @username patterns (e.g., divine.video/@samuelgrubbs)
  if (identifier.startsWith('@') && identifier.length > 1) {
    return <AtUsernamePage />;
  }

  const target = getDirectSearchTarget(identifier);
  if (!target) {
    return <NotFound />;
  }

  return <Navigate to={target.path} replace />;
}
