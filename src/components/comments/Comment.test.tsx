import { render, screen } from '@testing-library/react';
import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const COMMENTER_PUBKEY = 'a'.repeat(64);
const PARENT_PUBKEY = 'b'.repeat(64);

const authorMetadata = vi.hoisted(() => new Map<string, NostrMetadata>());

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: (pubkey: string) => ({
    data: authorMetadata.has(pubkey) ? { metadata: authorMetadata.get(pubkey) } : undefined,
  }),
}));

vi.mock('@/hooks/useComments', () => ({
  getDirectReplies: () => [],
  useComments: () => ({ data: { allComments: [] } }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: undefined }),
}));

vi.mock('@/hooks/useModeration', () => ({
  useMuteItem: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/useDeleteComment', () => ({
  useDeleteComment: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/NoteContent', () => ({
  NoteContent: ({ event }: { event: NostrEvent }) => <span>{event.content}</span>,
}));

vi.mock('@/components/SmartLink', () => ({
  SmartLink: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ReportContentDialog', () => ({ ReportContentDialog: () => null }));
vi.mock('@/components/DeleteCommentDialog', () => ({ DeleteCommentDialog: () => null }));
vi.mock('./CommentForm', () => ({ CommentForm: () => null }));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Comment } from './Comment';

function makeComment(pubkey: string, content: string): NostrEvent {
  return {
    id: pubkey,
    pubkey,
    created_at: 1_700_000_000,
    kind: 1111,
    tags: [],
    content,
    sig: 'c'.repeat(128),
  };
}

describe('Comment', () => {
  beforeEach(() => {
    authorMetadata.clear();
  });

  it('renders display_name when the commenter name is empty', () => {
    authorMetadata.set(COMMENTER_PUBKEY, {
      name: '',
      display_name: 'Visible Commenter',
      picture: 'https://example.com/commenter.png',
    });

    render(<Comment root={new URL('https://example.com/video')} comment={makeComment(COMMENTER_PUBKEY, 'Hello')} />);

    expect(screen.getByText('Visible Commenter')).toBeInTheDocument();
  });

  it('renders the parent display_name in a reply preview when its name is empty', () => {
    authorMetadata.set(COMMENTER_PUBKEY, { name: 'reply-author' });
    authorMetadata.set(PARENT_PUBKEY, {
      name: '',
      display_name: 'Visible Parent',
      picture: 'https://example.com/parent.png',
    });

    render(
      <Comment
        root={new URL('https://example.com/video')}
        comment={makeComment(COMMENTER_PUBKEY, 'Reply')}
        parentComment={makeComment(PARENT_PUBKEY, 'Parent comment')}
      />,
    );

    expect(screen.getByText('Visible Parent')).toBeInTheDocument();
  });
});
