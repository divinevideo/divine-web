import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditPeopleListDialog } from './EditPeopleListDialog';

const mockUpdatePeopleList = vi.fn();
const mockToast = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'editPeopleListDialog.title': 'Edit People List',
        'editPeopleListDialog.description': 'Update this list.',
        'editPeopleListDialog.nameLabel': 'List Name *',
        'editPeopleListDialog.namePlaceholder': 'Favorite Creators',
        'editPeopleListDialog.descriptionLabel': 'Description',
        'editPeopleListDialog.descriptionPlaceholder': 'People whose loops you never miss...',
        'editPeopleListDialog.imageLabel': 'Cover Image URL',
        'editPeopleListDialog.imagePlaceholder': 'https://example.com/image.jpg',
        'editPeopleListDialog.nameRequired': 'Name it first.',
        'editPeopleListDialog.imageInvalid': 'Use a full image URL.',
        'editPeopleListDialog.cancelButton': 'Cancel',
        'editPeopleListDialog.saveButton': 'Save',
        'editPeopleListDialog.savingButton': 'Saving...',
        'editPeopleListDialog.savedTitle': 'Saved.',
        'editPeopleListDialog.savedDescription': 'Updated.',
        'editPeopleListDialog.failedTitle': "Didn't save.",
        'editPeopleListDialog.failedDescription': 'Try again?',
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
  useUpdatePeopleList: () => ({
    mutateAsync: mockUpdatePeopleList,
    isPending: false,
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const OWNER = 'a'.repeat(64);

describe('EditPeopleListDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdatePeopleList.mockResolvedValue(undefined);
  });

  it('does not reset local edits when the same list refetches while open', () => {
    const { rerender } = render(
      <EditPeopleListDialog
        open
        onOpenChange={vi.fn()}
        list={{
          id: 'friends',
          name: 'Friends',
          description: 'Original',
          pubkey: OWNER,
          createdAt: 1,
          memberPubkeys: [],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('List Name *'), {
      target: { value: 'Typed name' },
    });

    rerender(
      <EditPeopleListDialog
        open
        onOpenChange={vi.fn()}
        list={{
          id: 'friends',
          name: 'Refetched name',
          description: 'Changed remotely',
          pubkey: OWNER,
          createdAt: 2,
          memberPubkeys: [],
        }}
      />,
    );

    expect(screen.getByLabelText('List Name *')).toHaveValue('Typed name');
  });

  it('submits metadata updates for the list id, clearing emptied fields', async () => {
    render(
      <EditPeopleListDialog
        open
        onOpenChange={vi.fn()}
        list={{
          id: 'friends',
          name: 'Friends',
          description: 'Original',
          pubkey: OWNER,
          createdAt: 1,
          memberPubkeys: [],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('List Name *'), {
      target: { value: 'Best People' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: '  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockUpdatePeopleList).toHaveBeenCalledWith({
      listId: 'friends',
      name: 'Best People',
      description: '',
      image: '',
    });
  });
});
