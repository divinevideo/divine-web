import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SentimentPrompt } from './SentimentPrompt';

const trackProductEvent = vi.fn().mockResolvedValue('event-id');
vi.mock('@/lib/analyticsClient', () => ({
  trackProductEvent: (...args: unknown[]) => trackProductEvent(...args),
}));

describe('SentimentPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks the selected sentiment score', async () => {
    const onAnswered = vi.fn();
    const user = userEvent.setup();

    render(
      <SentimentPrompt
        promptId="post-session-v1"
        promptType="post_session"
        surface="home"
        onAnswered={onAnswered}
      />
    );

    await user.click(screen.getByRole('button', { name: '5' }));

    expect(trackProductEvent).toHaveBeenCalledWith('sentiment_prompt_answered', {
      surface: 'home',
      value: 5,
      properties: {
        prompt_id: 'post-session-v1',
        prompt_type: 'post_session',
      },
    });
    expect(onAnswered).toHaveBeenCalledWith(5);
  });
});
