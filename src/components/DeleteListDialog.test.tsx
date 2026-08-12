import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DeleteListDialog } from './DeleteListDialog';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'deleteListDialog.title': 'Delete List?',
        'deleteListDialog.videosDescription': `This will permanently delete the list "${values?.name}". Videos in the list will not be affected.`,
        'deleteListDialog.peopleDescription': `This will permanently delete the list "${values?.name}". People in the list will not be affected.`,
        'deleteListDialog.noteLabel': 'Note:',
        'deleteListDialog.relayNote': 'This action sends a deletion request to relays.',
        'deleteListDialog.cancelButton': 'Cancel',
        'deleteListDialog.deletingButton': 'Deleting...',
        'deleteListDialog.deleteButton': 'Delete List',
      };
      return translations[key] ?? key;
    },
  }),
}));

describe('DeleteListDialog', () => {
  it('renders the video-list warning by default', () => {
    render(
      <DeleteListDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        listName="Favorites"
        isDeleting={false}
      />,
    );

    expect(screen.getByText('This will permanently delete the list "Favorites". Videos in the list will not be affected.')).toBeInTheDocument();
  });

  it('renders the people-list warning when requested', () => {
    render(
      <DeleteListDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        listName="Friends"
        isDeleting={false}
        listKind="people"
      />,
    );

    expect(screen.getByText('This will permanently delete the list "Friends". People in the list will not be affected.')).toBeInTheDocument();
  });

  it('confirms deletion from the destructive action', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteListDialog
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        listName="Friends"
        isDeleting={false}
        listKind="people"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete List' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
