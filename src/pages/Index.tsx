import { useSeoMeta } from '@unhead/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Navigate } from 'react-router-dom';

const Index = () => {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'diVine Web - Short-form Looping Videos on Nostr',
    description: 'Watch and share 6-second looping videos on the decentralized Nostr network.',
  });

  // Redirect to discovery - foryou for logged in, classics for logged out
  if (user) {
    return <Navigate to="/discovery/foryou" replace />;
  }

  return <Navigate to="/discovery/classics" replace />;
};

export default Index;
