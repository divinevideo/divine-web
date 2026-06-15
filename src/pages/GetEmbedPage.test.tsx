// ABOUTME: Tests for the embed code generator page
// ABOUTME: Verifies form rendering, embed code generation, and npub pre-fill

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initializeI18n } from '@/lib/i18n';
import { GetEmbedPage } from './GetEmbedPage';

// Mock MarketingLayout to simplify rendering
vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="marketing-layout">{children}</div>,
}));

// Mock clipboard API
const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
Object.assign(navigator, { clipboard: mockClipboard });

function renderPage(initialEntries: string[] = ['/get-embed']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <GetEmbedPage />
    </MemoryRouter>
  );
}

describe('GetEmbedPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('renders the page title and form fields', () => {
    renderPage();

    expect(screen.getByText('Embed Divine Widget')).toBeInTheDocument();
    expect(screen.getByLabelText(/npub/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/theme/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/videos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/auto-refresh/i)).toBeInTheDocument();
  });

  it('shows placeholder when no npub is entered', () => {
    renderPage();

    expect(screen.getByText(/enter your npub above/i)).toBeInTheDocument();
    expect(screen.queryByText('Embed Code')).not.toBeInTheDocument();
  });

  it('shows preview and embed code when valid npub is entered', () => {
    renderPage();

    const input = screen.getByLabelText(/npub/i);
    fireEvent.change(input, { target: { value: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xkwmn' } });

    expect(screen.getByText('Embed Code')).toBeInTheDocument();
    expect(screen.getByTitle('Divine Video Widget Preview')).toBeInTheDocument();
  });

  it('generates correct embed code with default options', () => {
    renderPage();

    const npub = 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xkwmn';
    const input = screen.getByLabelText(/npub/i);
    fireEvent.change(input, { target: { value: npub } });

    const codeBlock = screen.getByText(/iframe/i, { selector: 'pre' });
    expect(codeBlock.textContent).toContain(`src="https://divine.video/embed?npub=${npub}`);
    expect(codeBlock.textContent).toContain('theme=dark');
    expect(codeBlock.textContent).toContain('count=1');
    expect(codeBlock.textContent).toContain('width="350"');
    expect(codeBlock.textContent).toContain('height="380"');
  });

  it('updates embed code when theme changes', () => {
    renderPage();

    const input = screen.getByLabelText(/npub/i);
    fireEvent.change(input, { target: { value: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xkwmn' } });

    const themeSelect = screen.getByLabelText(/theme/i);
    fireEvent.change(themeSelect, { target: { value: 'light' } });

    const codeBlock = screen.getByText(/iframe/i, { selector: 'pre' });
    expect(codeBlock.textContent).toContain('theme=light');
  });

  it('updates height when video count changes', () => {
    renderPage();

    const input = screen.getByLabelText(/npub/i);
    fireEvent.change(input, { target: { value: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xkwmn' } });

    const countSelect = screen.getByLabelText(/videos/i);
    fireEvent.change(countSelect, { target: { value: '3' } });

    const codeBlock = screen.getByText(/iframe/i, { selector: 'pre' });
    // height = 200 + 3 * 180 = 740
    expect(codeBlock.textContent).toContain('height="740"');
  });

  it('copies embed code to clipboard', async () => {
    renderPage();

    const input = screen.getByLabelText(/npub/i);
    fireEvent.change(input, { target: { value: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xkwmn' } });

    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('<iframe')
      );
    });

    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('pre-fills npub from URL params', () => {
    const npub = 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xkwmn';
    renderPage([`/get-embed?npub=${npub}`]);

    const input = screen.getByLabelText(/npub/i) as HTMLInputElement;
    expect(input.value).toBe(npub);
    expect(screen.getByText('Embed Code')).toBeInTheDocument();
  });

  it('includes autorefresh param when not default (60)', () => {
    renderPage();

    const input = screen.getByLabelText(/npub/i);
    fireEvent.change(input, { target: { value: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xkwmn' } });

    const refreshSelect = screen.getByLabelText(/auto-refresh/i);
    fireEvent.change(refreshSelect, { target: { value: '30' } });

    const codeBlock = screen.getByText(/iframe/i, { selector: 'pre' });
    expect(codeBlock.textContent).toContain('autorefresh=30');
  });

  it('excludes autorefresh param when set to default (60)', () => {
    renderPage();

    const input = screen.getByLabelText(/npub/i);
    fireEvent.change(input, { target: { value: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xkwmn' } });

    const codeBlock = screen.getByText(/iframe/i, { selector: 'pre' });
    expect(codeBlock.textContent).not.toContain('autorefresh=');
  });
});
