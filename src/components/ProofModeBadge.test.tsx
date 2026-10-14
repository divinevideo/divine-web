import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProofModeBadge } from './ProofModeBadge';

describe('ProofModeBadge', () => {
  it('does not render compact-summary sentinel values in the details popover', () => {
    const { container } = render(
      <MemoryRouter>
        <ProofModeBadge
          level="basic_proof"
          showDetails
          proofData={{
            level: 'basic_proof',
            manifest: 'summary:present',
            pgpFingerprint: 'summary:present',
          }}
        />
      </MemoryRouter>
    );

    const trigger = container.querySelector('[title]');
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);

    expect(screen.queryByText('summary:present')).not.toBeInTheDocument();
  });
});
