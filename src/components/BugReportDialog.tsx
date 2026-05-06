// ABOUTME: Dialog to submit structured bug reports to Zendesk from the Support page
// ABOUTME: Collects subject, description, steps, expected behavior; guests need email

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useBugReport } from '@/hooks/useBugReport';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useToast } from '@/hooks/useToast';
import { CircleNotch as Loader2 } from '@phosphor-icons/react';

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BugReportDialog({ open, onClose }: BugReportDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { data: authorData } = useAuthor(user?.pubkey);
  const bugReport = useBugReport();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  useEffect(() => {
    if (!open) {
      setSubject('');
      setDescription('');
      setSteps('');
      setExpected('');
      setGuestEmail('');
    }
  }, [open]);

  const canSubmit =
    subject.trim().length > 0 &&
    description.trim().length > 0 &&
    (user ? true : guestEmail.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await bugReport.mutateAsync({
        subject: subject.trim(),
        description: description.trim(),
        stepsToReproduce: steps.trim() || undefined,
        expectedBehavior: expected.trim() || undefined,
        reporterPubkey: user?.pubkey,
        reporterName: authorData?.metadata?.display_name || authorData?.metadata?.name,
        reporterEmail: user ? undefined : guestEmail.trim(),
      });

      toast({
        title: t('support.bugReport.successTitle'),
        description: t('support.bugReport.successDescription'),
      });
      onClose();
    } catch (e) {
      toast({
        title: t('support.bugReport.errorTitle'),
        description: e instanceof Error ? e.message : t('support.bugReport.errorDescription'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('support.bugReport.title')}</DialogTitle>
          <DialogDescription>{t('support.bugReport.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!user && (
            <div className="space-y-2">
              <Label htmlFor="bug-report-email">{t('support.bugReport.emailLabel')}</Label>
              <Input
                id="bug-report-email"
                type="email"
                autoComplete="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder={t('support.bugReport.emailPlaceholder')}
                disabled={bugReport.isPending}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bug-report-subject">{t('support.bugReport.subjectLabel')}</Label>
            <Input
              id="bug-report-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('support.bugReport.subjectPlaceholder')}
              disabled={bugReport.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-report-description">{t('support.bugReport.descriptionLabel')}</Label>
            <Textarea
              id="bug-report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('support.bugReport.descriptionPlaceholder')}
              rows={4}
              disabled={bugReport.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-report-steps">{t('support.bugReport.stepsLabel')}</Label>
            <Textarea
              id="bug-report-steps"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder={t('support.bugReport.stepsPlaceholder')}
              rows={3}
              disabled={bugReport.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-report-expected">{t('support.bugReport.expectedLabel')}</Label>
            <Textarea
              id="bug-report-expected"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder={t('support.bugReport.expectedPlaceholder')}
              rows={2}
              disabled={bugReport.isPending}
            />
          </div>

          <p className="text-sm text-muted-foreground">{t('support.bugReport.metaHint')}</p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={bugReport.isPending}>
              {t('support.bugReport.cancel')}
            </Button>
            <Button type="button" variant="sticker" onClick={handleSubmit} disabled={!canSubmit || bugReport.isPending}>
              {bugReport.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('support.bugReport.sending')}
                </>
              ) : (
                t('support.bugReport.submit')
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
