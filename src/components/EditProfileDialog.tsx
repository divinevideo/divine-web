// ABOUTME: Dialog for editing user profile with form fields for metadata
// ABOUTME: Wraps EditProfileForm in a responsive dialog with close handling

import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EditProfileForm } from '@/components/EditProfileForm';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const { t } = useTranslation();
  const handleSuccess = () => {
    // Close the dialog after successful profile update
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('profile.editProfile')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('profile.editProfile')}
          </DialogDescription>
        </DialogHeader>
        <EditProfileForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
