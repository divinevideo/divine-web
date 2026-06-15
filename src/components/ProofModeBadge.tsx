// ABOUTME: Badge component for displaying Proofmode verification status
// ABOUTME: Shows different icons and colors based on verification level with detailed tooltip

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, ShieldWarning as ShieldAlert, CheckCircle, Info } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ProofModeLevel, ProofModeData } from '@/types/video';
import { Link } from 'react-router-dom';

export type ProofModeBadgeLevel = ProofModeLevel | 'platinum';

interface ProofModeBadgeProps {
  level: ProofModeBadgeLevel;
  proofData?: ProofModeData;
  className?: string;
  showDetails?: boolean; // Show popover with details
  size?: 'small' | 'medium' | 'large';
}

export function ProofModeBadge({ level, proofData, className, showDetails = false, size = 'small' }: ProofModeBadgeProps) {
  const { t } = useTranslation();
  const config = getProofModeConfig(level);
  const sizeConfig = getSizeConfig(size);
  const [open, setOpen] = useState(false);

  if (!config) return null;

  const Icon = config.icon;
  const label = t(`proofModeBadge.levels.${config.tKey}.label`);
  const tooltip = t(`proofModeBadge.levels.${config.tKey}.tooltip`);
  const description = t(`proofModeBadge.levels.${config.tKey}.description`);

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 font-medium cursor-help',
        config.className,
        sizeConfig.className,
        className
      )}
      title={tooltip}
    >
      <Icon className={sizeConfig.iconSize} />
      <span>{label}</span>
    </Badge>
  );

  if (!showDetails || !proofData) {
    return badge;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {badge}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", config.iconColor)} />
            <h3 className="font-semibold">{label}</h3>
          </div>

          <p className="text-sm text-muted-foreground">{description}</p>

          {/* Verification Details */}
          <div className="space-y-2 text-sm">
            {proofData.deviceAttestation && (
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-brand-dark-green dark:text-brand-green flex-shrink-0" />
                <div>
                  <p className="font-medium">{t('proofModeBadge.hardwareAttestation')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('proofModeBadge.hardwareAttestationDesc')}
                  </p>
                </div>
              </div>
            )}

            {proofData.pgpFingerprint && (
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-brand-blue-dark dark:text-brand-blue flex-shrink-0" />
                <div>
                  <p className="font-medium">{t('proofModeBadge.cryptographicSignature')}</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {proofData.pgpFingerprint}
                  </p>
                </div>
              </div>
            )}

            {proofData.manifestData && (
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium">{t('proofModeBadge.proofManifest')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('proofModeBadge.proofManifestDesc')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <Link
              to="/proofmode"
              className="text-sm text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              {t('proofModeBadge.learnMore')}
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getSizeConfig(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'small':
      return {
        className: 'text-[10px] px-1.5 py-0.5',
        iconSize: 'h-3 w-3',
      };
    case 'medium':
      return {
        className: 'text-[11px] px-2 py-1',
        iconSize: 'h-3.5 w-3.5',
      };
    case 'large':
      return {
        className: 'text-xs px-2.5 py-1.5',
        iconSize: 'h-4 w-4',
      };
  }
}

function getProofModeConfig(level: ProofModeBadgeLevel) {
  switch (level) {
    case 'platinum':
      return {
        icon: CheckCircle,
        tKey: 'platinum',
        className: 'border-[#E5E4E2] text-[#E5E4E2] bg-[#1A2A3A]',
        iconColor: 'text-[#E5E4E2]',
      };
    case 'verified_mobile':
      return {
        icon: CheckCircle,
        tKey: 'verifiedMobile',
        className: 'border-[#FFD700] text-[#FFD700] bg-[#3D2E00]',
        iconColor: 'text-[#FFD700]',
      };
    case 'verified_web':
      return {
        icon: CheckCircle,
        tKey: 'verifiedWeb',
        className: 'border-[#C0C0C0] text-[#C0C0C0] bg-[#2A2A2A]',
        iconColor: 'text-[#C0C0C0]',
      };
    case 'basic_proof':
      return {
        icon: ShieldAlert,
        tKey: 'basicProof',
        className: 'border-[#CD7F32] text-[#CD7F32] bg-[#2E1F0F]',
        iconColor: 'text-[#CD7F32]',
      };
    case 'unverified':
    default:
      return null;
  }
}
