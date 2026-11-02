import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HubSpotSignup } from './HubSpotSignup';

describe('HubSpotSignup', () => {
  it('loads the form only after the visitor requests email updates', async () => {
    render(<HubSpotSignup />);
    expect(document.querySelector('script[src*="hsforms.net"]')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /sign up for email updates/i }));

    expect(document.querySelector('script[src*="hsforms.net"]')).not.toBeNull();
  });
});
