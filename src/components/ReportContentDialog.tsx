// ABOUTME: Dialog for reporting content violations (NIP-56)
// ABOUTME: Allows users to report videos, users, or other content

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReportContent } from '@/hooks/useModeration';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CircleNotch as Loader2, Flag, SignIn as LogIn } from '@phosphor-icons/react';
import { useToast } from '@/hooks/useToast';
import { ContentFilterReason, REPORT_REASON_LABELS } from '@/types/moderation';

interface ReportContentDialogProps {
  open: boolean;
  onClose: () => void;
  eventId?: string;
  pubkey?: string;
  contentType?: 'video' | 'user' | 'comment';
}

export function ReportContentDialog({
  open,
  onClose,
  eventId,
  pubkey,
  contentType = 'video'
}: ReportContentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { data: authorData } = useAuthor(user?.pubkey);
  const { openLoginDialog } = useLoginDialog();
  const reportContent = useReportContent();
  const isLoggedIn = !!user;

  const [reason, setReason] = useState<ContentFilterReason>(ContentFilterReason.SPAM);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!eventId && !pubkey) {
      toast({
        title: t('reportContentDialog.toastNothingTitle'),
        description: t('reportContentDialog.toastNothingDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await reportContent.mutateAsync({
        eventId,
        pubkey,
        reason,
        details: details.trim() || undefined,
        contentType,
        reporterName: authorData?.metadata?.display_name || authorData?.metadata?.name,
      });

      toast({
        title: t('reportContentDialog.toastSentTitle'),
        description: t('reportContentDialog.toastSentDescription'),
      });

      // Reset and close
      setReason(ContentFilterReason.SPAM);
      setDetails('');
      onClose();
    } catch {
      toast({
        title: t('reportContentDialog.toastFailedTitle'),
        description: t('reportContentDialog.toastFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDialogTitle = () => {
    switch (contentType) {
      case 'user':
        return t('reportContentDialog.titleUser');
      case 'comment':
        return t('reportContentDialog.titleComment');
      default:
        return t('reportContentDialog.titleVideo');
    }
  };

  const getContentTypeLabel = () => {
    switch (contentType) {
      case 'user':
        return t('reportContentDialog.contentTypeUser');
      case 'comment':
        return t('reportContentDialog.contentTypeComment');
      default:
        return t('reportContentDialog.contentTypeVideo');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!isSubmitting && !newOpen) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            {t('reportContentDialog.description', { contentType: getContentTypeLabel() })}
          </DialogDescription>
        </DialogHeader>

        {!isLoggedIn ? (
          <div className="space-y-4 pb-2">
            <p className="text-sm text-muted-foreground">
              {t('reportContentDialog.loggedOutMessage')}
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                {t('reportContentDialog.cancel')}
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  openLoginDialog();
                }}
                className="flex-1"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {t('reportContentDialog.logIn')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            <div className="space-y-3">
              <Label>{t('reportContentDialog.reasonLabel', { contentType: getContentTypeLabel() })}</Label>
              <RadioGroup value={reason} onValueChange={(value) => setReason(value as ContentFilterReason)}>
                <div className="space-y-2">
                  {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
                    <div key={value} className="flex items-center space-x-2">
                      <RadioGroupItem value={value} id={value} />
                      <Label htmlFor={value} className="font-normal cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">{t('reportContentDialog.detailsLabel')}</Label>
              <Textarea
                id="details"
                placeholder={t('reportContentDialog.detailsPlaceholder')}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="bg-brand-yellow-light border border-brand-yellow p-3 rounded-md text-sm space-y-2 dark:bg-brand-yellow-dark">
              <p className="font-semibold text-brand-yellow-dark dark:text-brand-yellow">
                {t('reportContentDialog.publicNoticeTitle')}
              </p>
              <p className="text-muted-foreground">
                {t('reportContentDialog.publicNoticeBody')}
              </p>
              <p className="text-muted-foreground">
                {t('reportContentDialog.supportPrefix')}{' '}
                <a href="/support" className="text-primary hover:underline font-medium">
                  {t('reportContentDialog.supportLink')}
                </a>
                {t('reportContentDialog.supportSuffix')}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                {t('reportContentDialog.cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('reportContentDialog.submitting')}
                  </>
                ) : (
                  <>
                    <Flag className="h-4 w-4 mr-2" />
                    {t('reportContentDialog.submit')}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
