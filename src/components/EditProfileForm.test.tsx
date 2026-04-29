import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrMetadata } from '@nostrify/nostrify';
import { EditProfileForm } from './EditProfileForm';

const mockPublish = vi.fn().mockResolvedValue({});

const mockToast = vi.fn();
const mockRefetch = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/useUploadFile', () => ({
  useUploadFile: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const ctx = vi.hoisted(() => ({
  pubkey: 'a'.repeat(64),
  author: {
    isSuccess: false,
    isPending: true,
    isError: false,
    data: undefined as { metadata?: NostrMetadata } | undefined,
  },
  metadata: undefined as NostrMetadata | undefined,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: ctx.pubkey },
    metadata: ctx.metadata,
  }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    isSuccess: ctx.author.isSuccess,
    isPending: ctx.author.isPending,
    isError: ctx.author.isError,
    data: ctx.author.data,
    refetch: mockRefetch,
  }),
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublish,
    isPending: false,
  }),
}));

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EditProfileForm />
    </QueryClientProvider>,
  );
}

describe('EditProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx.author = {
      isSuccess: false,
      isPending: true,
      isError: false,
      data: undefined,
    };
    ctx.metadata = undefined;
  });

  it('shows retry UI when loading existing profile fails', async () => {
    const user = userEvent.setup();

    ctx.author = {
      isSuccess: false,
      isPending: false,
      isError: true,
      data: undefined,
    };

    renderForm();

    expect(screen.getByText(/couldn't load your current profile yet/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry loading profile/i });
    expect(retryBtn).not.toBeDisabled();

    await user.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('disables save until author profile query succeeds', () => {
    renderForm();
    const saveBtn = screen.getByRole('button', { name: /loading your profile/i });
    expect(saveBtn).toBeDisabled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('enables save after success when there is no prior kind 0', () => {
    ctx.author = {
      isSuccess: true,
      isPending: false,
      isError: false,
      data: {},
    };
    ctx.metadata = undefined;

    renderForm();

    expect(screen.getByRole('button', { name: /^save profile$/i })).not.toBeDisabled();
  });

  it('keeps lud16 from loaded metadata when saving', async () => {
    const user = userEvent.setup();
    const lud16 =
      'lnurl1dp68gurn8ghj7mr0vdskc6r0wd6z7mrww4exctthd96xserjv9mnzumfwv9kkZ4MP5K';

    ctx.author = {
      isSuccess: true,
      isPending: false,
      isError: false,
      data: {
        metadata: {
          name: 'Alice',
          lud16,
        },
      },
    };
    ctx.metadata = ctx.author.data!.metadata;

    renderForm();

    const saveBtn = screen.getByRole('button', { name: /^save profile$/i });
    expect(saveBtn).not.toBeDisabled();

    await user.click(saveBtn);

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const arg = mockPublish.mock.calls[0][0] as { kind: number; content: string };
    expect(arg.kind).toBe(0);
    const parsed = JSON.parse(arg.content) as NostrMetadata;
    expect(parsed.lud16).toBe(lud16);
    expect(parsed.client).toBe('divine.video');
  });
});
