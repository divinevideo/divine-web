import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HubSpotSignup } from './HubSpotSignup';

describe('HubSpotSignup', () => {
  it('uses readable ink on light surfaces and green on the dark footer', () => {
    const { rerender } = render(<HubSpotSignup />);
    const button = screen.getByRole('button', { name: /sign up for email updates/i });
    expect(button).toHaveClass('text-brand-dark-green');
    expect(button).toHaveClass('dark:text-brand-green');

    rerender(<HubSpotSignup onDark />);
    expect(button).toHaveClass('text-brand-green');
  });

  it('loads the form only after the visitor requests email updates', async () => {
    render(<HubSpotSignup />);
    expect(document.querySelector('script[src*="hsforms.net"]')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /sign up for email updates/i }));

    expect(document.querySelector('script[src*="hsforms.net"]')).not.toBeNull();
  });

  it('offers a retry when the form script fails to load', async () => {
    render(<HubSpotSignup />);
    await userEvent.click(screen.getByRole('button', { name: /sign up for email updates/i }));

    act(() => {
      document.querySelector('script[src*="hsforms.net"]')?.dispatchEvent(new Event('error'));
    });

    const retry = screen.getByRole('button', { name: /email form didn't load/i });
    expect(document.querySelector('script[src*="hsforms.net"]')).toBeNull();

    await userEvent.click(retry);

    expect(document.querySelector('script[src*="hsforms.net"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /loading email form/i })).toBeInTheDocument();
  });

  it('offers a retry when the email field never appears', () => {
    vi.useFakeTimers();
    try {
      render(<HubSpotSignup />);
      fireEvent.click(screen.getByRole('button', { name: /sign up for email updates/i }));

      act(() => {
        vi.advanceTimersByTime(15_000);
      });

      expect(screen.getByRole('button', { name: /email form didn't load/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late error from the attempt it gave up on', () => {
    vi.useFakeTimers();
    try {
      render(<HubSpotSignup />);
      fireEvent.click(screen.getByRole('button', { name: /sign up for email updates/i }));
      const abandoned = document.querySelector('script[src*="hsforms.net"]');

      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      fireEvent.click(screen.getByRole('button', { name: /email form didn't load/i }));
      act(() => {
        abandoned?.dispatchEvent(new Event('error'));
      });

      expect(screen.getByRole('button', { name: /loading email form/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps keyboard focus until the email field appears, then focuses it', async () => {
    render(<HubSpotSignup />);
    const button = screen.getByRole('button', { name: /sign up for email updates/i });
    button.focus();

    await userEvent.keyboard('{Enter}');

    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('button', { name: /loading email form/i })).toBeInTheDocument();

    const input = document.createElement('input');
    input.type = 'email';
    document.querySelector('.hs-form-html')?.appendChild(input);

    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(screen.queryByRole('button', { name: /loading email form/i })).toBeNull();
  });
});
