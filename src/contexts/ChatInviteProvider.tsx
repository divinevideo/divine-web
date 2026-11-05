import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ChatInviteContext } from '@/contexts/ChatInviteContext';
import type { Invite } from '@/lib/chat/invite';

type Held = { account?: string; selection: { communityId: string; invite: Invite } | null };
export function ChatInviteProvider({ account, children }: PropsWithChildren<{ account?: string }>) {
  const [held, setHeld] = useState<Held>({ account, selection: null });
  const scope = useRef({ account, generation: 0 });
  if (scope.current.account !== account) scope.current = { account, generation: scope.current.generation + 1 };
  const generation = scope.current.generation;
  if (held.account !== account) setHeld({ account, selection: null });
  const retain = useCallback((communityId: string, invite: Invite) => {
    if (!account || scope.current.account !== account || scope.current.generation !== generation) return;
    setHeld(previous => previous.account === account && previous.selection?.communityId === communityId && previous.selection.invite === invite
      ? previous : { account, selection: { communityId, invite } });
  }, [account, generation]);
  const value = useMemo(() => ({ account, selection: held.account === account ? held.selection : null, retain }), [account, held, retain]);
  return <ChatInviteContext.Provider value={value}>{children}</ChatInviteContext.Provider>;
}
