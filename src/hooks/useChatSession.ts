/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Chat session hook — login gate, invite resume, account-switch isolation.
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from './useCurrentUser';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { ChatStore } from '@/lib/chat/store';
import { consumeInvite, parseInviteHash, stashInvite, stripInviteFromUrl } from '@/lib/chat/invite';
import { probeSignerCapabilities } from '@/lib/chat/protocol';

export function useChatSession() {
  const { user, signer, isResolvingJwt } = useCurrentUser();
  const { openLoginDialog } = useLoginDialog();
  const navigate = useNavigate();
  const storeRef = useRef<ChatStore | null>(null);
  const pubkey = user?.pubkey;

  // Capture invite fragment before anything can log the URL; never sent to analytics.
  useEffect(() => {
    const invite = parseInviteHash(window.location.hash);
    if (invite) { stashInvite(invite); stripInviteFromUrl(); }
  }, []);

  useEffect(() => {
    if (!pubkey) {
      storeRef.current?.dispose(); storeRef.current = null;
      if (!isResolvingJwt) openLoginDialog();
      return;
    }
    if (storeRef.current && storeRef.current.scope !== `chat:v1:${pubkey}`) storeRef.current.dispose();
    if (!storeRef.current) storeRef.current = new ChatStore(pubkey);
    const invite = consumeInvite();
    if (invite) navigate(`/chat/${invite.communityId}`, { replace: true });
  }, [pubkey, isResolvingJwt, navigate, openLoginDialog]);

  useEffect(() => () => { storeRef.current?.dispose(); storeRef.current = null; }, []);
  const capabilities = useMemo(() => probeSignerCapabilities(signer as never), [signer]);
  return { user, signer, isResolvingJwt, store: storeRef.current, capabilities, isLoggedIn: Boolean(pubkey) };
}
