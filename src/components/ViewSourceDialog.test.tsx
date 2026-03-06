import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { ViewSourceDialog } from '@/components/ViewSourceDialog';

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

Object.assign(navigator, { clipboard: mockClipboard });

const event: NostrEvent = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  created_at: 1727670975,
  kind: 34236,
  content: 'Raw event payload',
  tags: [
    ['url', 'https://example.com/video.mp4'],
    ['thumb', 'https://cdn.example.com/thumb.jpg'],
  ],
  sig: 'c'.repeat(128),
};

describe('ViewSourceDialog', () => {
  beforeEach(() => {
    mockClipboard.writeText.mockClear();
  });

  it('renders clickable URLs inside the JSON block', () => {
    render(
      <ViewSourceDialog
        open
        onClose={vi.fn()}
        event={event}
      />,
    );

    expect(screen.getByLabelText('Raw Nostr event JSON')).toHaveClass('select-text');
    expect(screen.getByRole('link', { name: 'https://example.com/video.mp4' })).toHaveAttribute('href', 'https://example.com/video.mp4');
    expect(screen.getByRole('link', { name: 'https://cdn.example.com/thumb.jpg' })).toHaveAttribute('href', 'https://cdn.example.com/thumb.jpg');
  });

  it('copies the full JSON payload from the copy button', async () => {
    render(
      <ViewSourceDialog
        open
        onClose={vi.fn()}
        event={event}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy json/i }));

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(JSON.stringify(event, null, 2));
    });
  });
});
