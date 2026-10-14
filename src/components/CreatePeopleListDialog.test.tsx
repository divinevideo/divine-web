import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreatePeopleListDialog } from './CreatePeopleListDialog';

const mockCreatePeopleList = vi.fn();
const mockToast = vi.fn();
const mockNavigate = vi.fn();
const OWNER = 'a'.repeat(64);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'createPeopleListDialog.title': 'Create People List',
        'createPeopleListDialog.description': 'Group people together.',
        'createPeopleListDialog.nameLabel': 'List Name *',
        'createPeopleListDialog.namePlaceholder': 'Favorite Creators',
        'createPeopleListDialog.descriptionLabel': 'Description',
        'createPeopleListDialog.descriptionPlaceholder': 'People whose loops you never miss...',
        'createPeopleListDialog.imageLabel': 'Cover Image URL',
        'createPeopleListDialog.imagePlaceholder': 'https://example.com/image.jpg',
        'createPeopleListDialog.nameRequired': 'Name it first.',
        'createPeopleListDialog.reservedName': 'That name is reserved for a system list.',
        'createPeopleListDialog.imageInvalid': 'Use a full image URL.',
        'createPeopleListDialog.cancelButton': 'Cancel',
        'createPeopleListDialog.createButton': 'Create List',
        'createPeopleListDialog.creatingButton': 'Creating...',
        'createPeopleListDialog.createdTitle': 'People list created.',
        'createPeopleListDialog.createdDescription': 'Ready.',
        'createPeopleListDialog.failedTitle': "Didn't make it.",
        'createPeopleListDialog.failedDescription': 'Try again?',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/hooks/usePeopleListMutations', () => ({
  useCreatePeopleList: () => ({
    mutateAsync: mockCreatePeopleList,
    isPending: false,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: OWNER } }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

function renderDialog() {
  return render(
    <MemoryRouter>
      <CreatePeopleListDialog open onOpenChange={vi.fn()} prefilledMembers={['b'.repeat(64)]} />
    </MemoryRouter>,
  );
}

describe('CreatePeopleListDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatePeopleList.mockResolvedValue(undefined);
  });

  it('blocks reserved system list names before publishing', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('List Name *'), {
      target: { value: 'block' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create List' }));

    expect(screen.getByRole('alert')).toHaveTextContent('That name is reserved for a system list.');
    expect(screen.getByLabelText('List Name *')).toHaveAttribute('aria-invalid', 'true');
    expect(mockCreatePeopleList).not.toHaveBeenCalled();
  });

  it('creates a people list with prefilled members', async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('List Name *'), {
      target: { value: 'Favorite Creators' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create List' }));

    await waitFor(() => {
      expect(mockCreatePeopleList).toHaveBeenCalledWith({
        id: 'favorite-creators',
        name: 'Favorite Creators',
        description: undefined,
        image: undefined,
        memberPubkeys: ['b'.repeat(64)],
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith(`/people-lists/${OWNER}/favorite-creators`);
  });
});
