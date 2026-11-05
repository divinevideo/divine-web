import { useContext, type ContextType } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatInviteContext } from './ChatInviteContext';
import { ChatInviteProvider } from './ChatInviteProvider';
import type { Invite } from '@/lib/chat/invite';

const invite: Invite = { naddr: 'synthetic locator', tokenHex: 'ab'.repeat(16) };
let current: ContextType<typeof ChatInviteContext>;
function Selection() {
  current = useContext(ChatInviteContext);
  return <p>{current?.selection?.communityId ?? 'No verified community'}</p>;
}

describe('verified chat invite lifetime', () => {
  it.each(['switch', 'logout'])('clears synchronously on %s and rejects a stale verification callback', mode => {
    const account = 'a'.repeat(64);
    const view = render(<ChatInviteProvider account={account}><Selection /></ChatInviteProvider>);
    act(() => current!.retain('synthetic-community', invite));
    expect(screen.getByText('synthetic-community')).toBeInTheDocument();
    const stale = current!.retain;
    view.rerender(<ChatInviteProvider account={mode === 'switch' ? 'b'.repeat(64) : undefined}><Selection /></ChatInviteProvider>);
    expect(screen.getByText('No verified community')).toBeInTheDocument();
    act(() => stale('synthetic-community', invite));
    expect(screen.getByText('No verified community')).toBeInTheDocument();
    view.rerender(<ChatInviteProvider account={account}><Selection /></ChatInviteProvider>);
    act(() => stale('synthetic-community', invite));
    expect(screen.getByText('No verified community')).toBeInTheDocument();
  });
});
