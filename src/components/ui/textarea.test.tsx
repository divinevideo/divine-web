import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Textarea } from './textarea';

function installTextareaHeights(initialHeights: { offsetHeight: number; scrollHeight: number }) {
  const heights = { ...initialHeights };
  const offsetHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'offsetHeight');
  const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight');

  Object.defineProperty(HTMLTextAreaElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => heights.offsetHeight,
  });
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => heights.scrollHeight,
  });

  return {
    set(nextHeights: { offsetHeight: number; scrollHeight: number }) {
      heights.offsetHeight = nextHeights.offsetHeight;
      heights.scrollHeight = nextHeights.scrollHeight;
    },
    restore() {
      if (offsetHeightDescriptor) {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'offsetHeight', offsetHeightDescriptor);
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, 'offsetHeight');
      }

      if (scrollHeightDescriptor) {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', scrollHeightDescriptor);
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, 'scrollHeight');
      }
    },
  };
}

describe('Textarea', () => {
  it('preserves the current baseline height before content grows', async () => {
    const mockHeights = installTextareaHeights({ offsetHeight: 96, scrollHeight: 96 });

    render(<Textarea rows={3} value="" onChange={() => undefined} />);
    const textarea = screen.getByRole('textbox');

    await waitFor(() => expect(textarea.style.height).toBe('96px'));
    mockHeights.restore();
  });

  it('grows to the content height until it reaches the max height', async () => {
    const mockHeights = installTextareaHeights({ offsetHeight: 80, scrollHeight: 80 });

    const { rerender } = render(<Textarea value="" onChange={() => undefined} />);
    const textarea = screen.getByRole('textbox');

    mockHeights.set({ offsetHeight: 80, scrollHeight: 180 });
    rerender(<Textarea value={'line 1\nline 2\nline 3'} onChange={() => undefined} />);

    await waitFor(() => expect(textarea.style.height).toBe('180px'));
    expect(textarea.style.overflowY).toBe('hidden');
    mockHeights.restore();
  });

  it('switches to internal scrolling after the max height is reached', async () => {
    const mockHeights = installTextareaHeights({ offsetHeight: 80, scrollHeight: 80 });

    const { rerender } = render(
      <Textarea value="" onChange={() => undefined} maxAutoHeight="120px" />,
    );
    const textarea = screen.getByRole('textbox');

    mockHeights.set({ offsetHeight: 80, scrollHeight: 240 });
    rerender(<Textarea value={'long value'} onChange={() => undefined} maxAutoHeight="120px" />);

    await waitFor(() => expect(textarea.style.height).toBe('120px'));
    expect(textarea.style.overflowY).toBe('auto');
    mockHeights.restore();
  });

  it('resets back to the measured baseline when the controlled value clears', async () => {
    const mockHeights = installTextareaHeights({ offsetHeight: 80, scrollHeight: 180 });

    const { rerender } = render(<Textarea value={'long value'} onChange={() => undefined} />);
    const textarea = screen.getByRole('textbox');

    await waitFor(() => expect(textarea.style.height).toBe('180px'));

    mockHeights.set({ offsetHeight: 80, scrollHeight: 80 });
    rerender(<Textarea value="" onChange={() => undefined} />);

    await waitFor(() => expect(textarea.style.height).toBe('80px'));
    mockHeights.restore();
  });
});
