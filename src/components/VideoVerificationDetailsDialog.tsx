// ABOUTME: Modal explaining original Vine, Proofmode, AI detection, and hosting badges for a video
// ABOUTME: Uses the same decision helpers as the badge row so the UI stays aligned with mobile badge rules

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, CheckCircle as CheckCircle2, ArrowSquareOut as ExternalLink, CircleNotch as Loader2, MagnifyingGlass as Search, ShieldCheck, XCircle } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useVideoVerification } from '@/hooks/useVideoVerification';
import {
  type AIDetectionResult,
  type VerificationSummaryTone,
  getProofChecklist,
  getVerificationIntroKey,
  getVerificationSummary,
  isOriginalVineVideo,
  shouldFetchAiForDetails,
} from '@/lib/videoVerification';
import type { ParsedVideoData } from '@/types/video';
import { Link } from 'react-router-dom';

interface VideoVerificationDetailsDialogProps {
  video: ParsedVideoData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoVerificationDetailsDialog({
  video,
  open,
  onOpenChange,
}: VideoVerificationDetailsDialogProps) {
  const { t } = useTranslation();
  const { aiResult, isFetching, refetch } = useVideoVerification(video, {
    autoFetchAi: open && shouldFetchAiForDetails(video),
  });
  const [checkedAndEmpty, setCheckedAndEmpty] = useState(false);
  const isOriginalVine = isOriginalVineVideo(video);

  useEffect(() => {
    if (!open) {
      setCheckedAndEmpty(false);
    }
  }, [open]);

  const handleManualCheck = async () => {
    const result = await refetch();
    setCheckedAndEmpty(!result.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isOriginalVine ? (
              <Archive className="h-5 w-5 text-brand-green" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-primary" />
            )}
            {isOriginalVine ? t('verification.dialog.titleArchive') : t('verification.dialog.titleVideo')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('verification.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        {isOriginalVine ? (
          <OriginalVineDetails video={video} />
        ) : (
          <VerificationDetails
            video={video}
            aiResult={aiResult}
            isFetching={isFetching}
            checkedAndEmpty={checkedAndEmpty}
            onManualCheck={handleManualCheck}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OriginalVineDetails({ video }: { video: ParsedVideoData }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 text-sm">
      <p className="font-medium">{t('verification.dialog.archiveBlurb')}</p>

      <p className="text-muted-foreground">{t('verification.dialog.archiveContext')}</p>

      {typeof video.loopCount === 'number' && video.loopCount > 0 && (
        <p className="text-xs italic text-muted-foreground">
          {t('verification.dialog.originalLoops', { count: video.loopCount.toLocaleString() })}
        </p>
      )}

      <ExternalTextLink
        href="https://divine.video/dmca"
        label={t('verification.dialog.archiveLearnMore')}
      />
    </div>
  );
}

interface VerificationDetailsProps {
  video: ParsedVideoData;
  aiResult: AIDetectionResult | null;
  isFetching: boolean;
  checkedAndEmpty: boolean;
  onManualCheck: () => void;
}

function VerificationDetails({
  video,
  aiResult,
  isFetching,
  checkedAndEmpty,
  onManualCheck,
}: VerificationDetailsProps) {
  const { t } = useTranslation();
  const summary = getVerificationSummary(video, aiResult);
  const checklist = getProofChecklist(video.proofMode);
  const introKey = getVerificationIntroKey(video, aiResult);

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium">{t(introKey)}</p>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>{t('verification.dialog.proofModeSection')}</span>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
          <div className={getSummaryToneClass(summary.tone)}>
            <ShieldCheck className="h-4 w-4" />
          </div>
          <p className="text-sm text-muted-foreground">{t(summary.key)}</p>
        </div>

        <div className="space-y-2">
          {checklist.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-sm">
              {item.passed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={item.passed ? 'text-foreground' : 'text-muted-foreground'}>
                {t(item.key)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4 text-primary" />
          <span>{t('verification.dialog.aiDetectionSection')}</span>
        </div>

        {aiResult ? (
          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/40 p-3">
            <div className="flex items-start gap-2">
              <span className={aiResult.score >= 0.5 ? 'text-amber-500' : 'text-green-600'}>
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t('verification.dialog.aiLikelihood', { percent: Math.round(aiResult.score * 100) })}
                </p>
                {aiResult.source && (
                  <p className="text-xs text-muted-foreground">
                    {t('verification.dialog.scannedBy', { source: aiResult.source })}
                  </p>
                )}
                {aiResult.isVerified && (
                  <p className="text-xs text-primary">
                    {t('verification.dialog.verifiedByMod')}
                  </p>
                )}
              </div>
            </div>
            <Progress value={aiResult.score * 100} className={aiResult.score >= 0.5 ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-600'} />
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/40 p-3">
            <p className="text-sm font-medium text-muted-foreground">
              {t('verification.dialog.aiNotScanned')}
            </p>

            {isFetching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('verification.dialog.checking')}</span>
              </div>
            ) : checkedAndEmpty ? (
              <p className="text-xs italic text-muted-foreground">
                {t('verification.dialog.noScanResults')}
              </p>
            ) : null}

            {!isFetching && (
              <Button type="button" variant="outline" size="sm" onClick={onManualCheck} className="w-full justify-center">
                <Search className="mr-2 h-4 w-4" />
                {t('verification.dialog.checkAi')}
              </Button>
            )}
          </div>
        )}
      </section>

      <div className="space-y-2 border-t pt-3 text-sm">
        <InternalTextLink href="/proofmode" label={t('verification.dialog.learnMore')} />
        {video.videoUrl && (
          <ExternalTextLink
            href={`https://check.proofmode.org/#${video.videoUrl}`}
            label={t('verification.dialog.inspectTool')}
          />
        )}
      </div>
    </div>
  );
}

function getSummaryToneClass(tone: VerificationSummaryTone) {
  switch (tone) {
    case 'platinum':
      return 'text-[#E5E4E2]';
    case 'gold':
      return 'text-[#FFD700]';
    case 'silver':
      return 'text-[#C0C0C0]';
    case 'bronze':
      return 'text-[#CD7F32]';
    case 'muted':
    default:
      return 'text-muted-foreground';
  }
}

function ExternalTextLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
    >
      <ExternalLink className="h-4 w-4" />
      <span>{label}</span>
    </a>
  );
}

function InternalTextLink({ href, label }: { href: string; label: string }) {
  return (
    <Link to={href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
      <ExternalLink className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}
