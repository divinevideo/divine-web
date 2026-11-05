import { createContext } from 'react';
import type { Invite } from '@/lib/chat/invite';

export const ChatInviteContext = createContext<{
  account?: string;
  selection: { communityId: string; invite: Invite } | null;
  retain: (communityId: string, invite: Invite) => void;
} | null>(null);
