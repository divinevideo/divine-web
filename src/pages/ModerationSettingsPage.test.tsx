import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';

import { initializeI18n } from '@/lib/i18n';
import ModerationSettingsPage from './ModerationSettingsPage';

const {
  mockToast,
  mockNostrQuery,
  mockInvalidateQueries,
  mockMuteList,
  mockBlockedPubkeys,
  mockMute,
  mockUnmute,
} = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockNostrQuery: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockMuteList: [] as Array<{
    type: string;
    value: string;
    reason?: string;
    createdAt: number;
    origin?: 'web' | 'unknown';
  }>,
  mockBlockedPubkeys: new Set<string>(),
  mockMute: vi.fn(),
  mockUnmute: vi.fn(),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: 'f'.repeat(64) },
  }),
}));

vi.mock('@/hooks/useModeration', () => ({
  useMuteList: () => ({
    data: mockMuteList,
    isLoading: false,
  }),
  useMuteItem: () => ({
    mutateAsync: mockMute,
    isPending: false,
  }),
  useUnmuteItem: () => ({
    mutateAsync: mockUnmute,
    isPending: false,
  }),
  useReportHistory: () => ({
    data: [],
  }),
  MUTE_LIST_KIND: 10000,
}));

vi.mock('@/hooks/useBlockList', () => ({
  useBlockedPubkeys: () => mockBlockedPubkeys,
  useUnblockUser: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: {
      metadata: {
        name: 'alice',
      },
    },
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: HTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode; value: string }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarImage: (props: HTMLAttributes<HTMLImageElement>) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

function installLocalStorageMock() {
  const store = new Map<string, string>();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ModerationSettingsPage />
    </QueryClientProvider>,
  );
}

describe('ModerationSettingsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockMuteList.length = 0;
    mockBlockedPubkeys.clear();
    installLocalStorageMock();
    localStorage.clear();
    mockNostrQuery.mockResolvedValue([]);
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

  it('lets the developer switch Funnelcake API mode to staging from the debug panel', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /show debug info/i }));

    fireEvent.change(screen.getByRole('combobox', { name: /funnelcake api/i }), {
      target: { value: 'staging' },
    });

    await waitFor(() => {
      expect(localStorage.getItem('divine_dev_funnelcake_api_mode')).toBe('staging');
    });

    expect(screen.getByText('https://api.staging.divine.video')).toBeInTheDocument();
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('splits explicit blocked users out of the muted users card', async () => {
    mockMuteList.push(
      { type: 'p', value: 'a'.repeat(64), createdAt: 1 },
      { type: 'p', value: 'b'.repeat(64), createdAt: 1 },
    );
    mockBlockedPubkeys.add('a'.repeat(64));

    renderPage();

    expect(screen.getByRole('heading', { name: /blocked users \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /muted users \(1\)/i })).toBeInTheDocument();
  });

  it('groups the remaining mutes by local provenance', async () => {
    mockMuteList.push(
      { type: 'p', value: 'a'.repeat(64), createdAt: 1, origin: 'web' },
      { type: 'p', value: 'b'.repeat(64), createdAt: 1, origin: 'unknown' },
      { type: 'p', value: 'c'.repeat(64), createdAt: 1, origin: 'unknown' },
    );

    renderPage();

    expect(screen.getByRole('heading', { name: /muted here \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /muted or blocked elsewhere \(2\)/i })).toBeInTheDocument();
  });

  it('requires confirmation before lifting a mute of unknown origin', async () => {
    mockMuteList.push({ type: 'p', value: 'b'.repeat(64), createdAt: 1, origin: 'unknown' });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /review/i }));

    expect(await screen.findByText(/may be a Block set in the Divine app/i)).toBeInTheDocument();
    expect(mockUnmute).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /lift it/i }));

    await waitFor(() => {
      expect(mockUnmute).toHaveBeenCalledWith({ type: 'p', value: 'b'.repeat(64) });
    });
  });

  it('still confirms before lifting a mute web authored itself', async () => {
    mockMuteList.push({ type: 'p', value: 'a'.repeat(64), createdAt: 1, origin: 'web' });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /review/i }));

    expect(await screen.findByText(/This mute was added from web/i)).toBeInTheDocument();
    expect(mockUnmute).not.toHaveBeenCalled();
  });

  it('explains why the current user cannot mute themselves', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/npub or pubkey/i), {
      target: { value: nip19.npubEncode('f'.repeat(64)) },
    });
    fireEvent.click(screen.getByRole('button', { name: /add to mute list/i }));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'You can’t mute yourself.',
      variant: 'destructive',
    });
    expect(mockMute).not.toHaveBeenCalled();
  });
});
