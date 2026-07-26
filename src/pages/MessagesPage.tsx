import { useEffect } from 'react';

import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';

export function MessagesPage() {
  const navigate = useSubdomainNavigate();

  useEffect(() => {
    navigate(getSupportDmConversationPath(), { replace: true });
  }, [navigate]);

  return null;
}

export default MessagesPage;
