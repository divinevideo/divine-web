// ABOUTME: Owner-guarded edit page for a NIP-51 people list.
// Non-owners and logged-out users are immediately redirected to the detail page.

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { decodeListIdParam, buildListPath } from '@/lib/eventRouting';
import { PeopleListEditMode } from '@/components/PeopleListEditMode';

export default function ListEditPage() {
  const { pubkey = '', listId = '' } = useParams();
  const dTag = decodeListIdParam(listId);
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.pubkey !== pubkey) {
      navigate(buildListPath(pubkey, dTag), { replace: true });
    }
  }, [user, pubkey, dTag, navigate]);

  if (!user || user.pubkey !== pubkey) return null;
  return <PeopleListEditMode pubkey={pubkey} dTag={dTag} />;
}
