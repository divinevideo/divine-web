/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventTimeMs, type Rumor } from '@/lib/chat/protocol';
import { ChatShell } from './ChatShell';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChatShell', () => {
  it('sends a message bound to the channel binding, stamped from a single clock read', () => {
    const onSendLive = vi.fn<(rumor: Rumor) => void>();
    const channelId = 'dd'.repeat(32);
    render(
      <MemoryRouter>
        <ChatShell communityId="demo-community" channelId="general" authorPubkey={'a'.repeat(64)}
          binding={{ channelId, epoch: 1 }} liveMessages={[]} onSendLive={onSendLive} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hi' } });

    // The clock alternates across a second boundary, so two reads can never agree.
    const reads = [1700000000999, 1700000001000];
    let call = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => reads[call++ % 2]);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onSendLive).toHaveBeenCalledTimes(1);
    const rumor = onSendLive.mock.calls[0][0];
    expect(rumor.tags).toContainEqual(['channel', channelId]);
    expect(rumor.tags).toContainEqual(['epoch', '1']);
    expect(reads).toContain(eventTimeMs(rumor));
  });
});
