// ABOUTME: Dialog for reporting content violations (NIP-56)
// ABOUTME: Allows users to report videos, users, or other content

import { useState } from 'react';
import { useReportContent } from '@/hooks/useModeration';
import { useAnonymousReport } from '@/hooks/useAnonymousReport';
import { useCurrentUser } from '@/hooks/useCurrentUser';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Flag } from 'lucide-react';
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
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const reportContent = useReportContent();
  const anonymousReport = useAnonymousReport();
  const isLoggedIn = !!user;

  const [reason, setReason] = useState<ContentFilterReason>(ContentFilterReason.SPAM);
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!eventId && !pubkey) {
      toast({
        title: 'Error',
        description: 'No content specified for reporting',
        variant: 'destructive',
      });
      return;
    }

    if (!isLoggedIn && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLoggedIn) {
        await reportContent.mutateAsync({
          eventId,
          pubkey,
          reason,
          details: details.trim() || undefined,
          contentType,
        });
      } else {
        await anonymousReport.mutateAsync({
          email,
          eventId,
          pubkey,
          contentType,
          reason,
          details: details.trim() || undefined,
        });
      }

      toast({
        title: 'Report submitted',
        description: 'Thank you for helping keep the community safe',
      });

      // Reset and close
      setReason(ContentFilterReason.SPAM);
      setDetails('');
      setEmail('');
      onClose();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to submit report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDialogTitle = () => {
    switch (contentType) {
      case 'user':
        return 'Report User';
      case 'comment':
        return 'Report Comment';
      default:
        return 'Report Video';
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
            Help us understand what's wrong with this {contentType}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pb-2">
          <div className="space-y-3">
            <Label>Why are you reporting this {contentType}?</Label>
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

          {!isLoggedIn && (
            <div className="space-y-2">
              <Label htmlFor="email">Email address (required)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                We'll use this to follow up on your report
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              id="details"
              placeholder="Provide any additional context that might be helpful..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {isLoggedIn ? (
            <div className="bg-brand-yellow-light border border-brand-yellow p-3 rounded-md text-sm space-y-2 dark:bg-brand-yellow-dark">
              <p className="font-semibold text-brand-yellow-dark dark:text-brand-yellow">
                ⚠️ Reports are PUBLIC information
              </p>
              <p className="text-muted-foreground">
                Reports are published as NIP-56 events on the Nostr network and will be linked to your username.
                Do not include sensitive or private information in reports.
              </p>
              <p className="text-muted-foreground">
                If you have a sensitive issue to share privately, please use our{' '}
                <a href="/support" className="text-primary hover:underline font-medium">
                  support helpdesk
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="bg-brand-blue-light border border-brand-blue p-3 rounded-md text-sm dark:bg-brand-blue-dark">
              <p className="text-muted-foreground">
                Your report will be sent privately to our moderation team. You can follow up on your report through the support widget.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
