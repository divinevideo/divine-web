// ABOUTME: Badge component for displaying ProofMode verification status
// ABOUTME: Shows different icons and colors based on verification level with detailed tooltip

import { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Info } from 'lucide-react';

// Custom icon component for the no-AI/Human Made icon
function HumanMadeIcon({ className }: { className?: string }) {
  return (
    <img
      src="/ui-icons/human-made.svg"
      alt="Human Made"
      className={className}
    />
  );
}
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ProofModeLevel, ProofModeData } from '@/types/video';
import { Link } from 'react-router-dom';

interface ProofModeBadgeProps {
  level: ProofModeLevel;
  proofData?: ProofModeData;
  className?: string;
  showDetails?: boolean; // Show popover with details
  size?: 'small' | 'medium' | 'large';
}

export function ProofModeBadge({ level, proofData, className, showDetails = false, size = 'small' }: ProofModeBadgeProps) {
  const config = getProofModeConfig(level);
  const sizeConfig = getSizeConfig(size);
  const [open, setOpen] = useState(false);

  if (!config) return null;

  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 font-medium cursor-help',
        config.className,
        sizeConfig.className,
        className
      )}
      title={config.tooltip}
    >
      <Icon className={sizeConfig.iconSize} />
      <span>{config.label}</span>
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
            <h3 className="font-semibold">{config.label}</h3>
          </div>

          <p className="text-sm text-muted-foreground">{config.description}</p>

          {/* Verification Details */}
          <div className="space-y-2 text-sm">
            {proofData.deviceAttestation && (
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-brand-dark-green dark:text-brand-green flex-shrink-0" />
                <div>
                  <p className="font-medium">Hardware Attestation</p>
                  <p className="text-xs text-muted-foreground">
                    Verified on secure mobile device
                  </p>
                </div>
              </div>
            )}

            {proofData.pgpFingerprint && (
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-brand-blue-dark dark:text-brand-blue flex-shrink-0" />
                <div>
                  <p className="font-medium">Cryptographic Signature</p>
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
                  <p className="font-medium">Proof Manifest</p>
                  <p className="text-xs text-muted-foreground">
                    Contains frame hashes and session data
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <Link
              to="/proof-mode"
              className="text-sm text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Learn more about ProofMode →
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

function getProofModeConfig(level: ProofModeLevel) {
  switch (level) {
    case 'verified_mobile':
      return {
        icon: HumanMadeIcon,
        label: 'Human Made',
        className: 'border-brand-green text-brand-dark-green dark:text-brand-green bg-brand-light-green dark:bg-brand-dark-green',
        iconColor: 'text-brand-dark-green dark:text-brand-green',
        tooltip: 'Human made - captured on secure mobile device with ProofMode',
        description: 'This video was captured by a human on a mobile device with hardware-backed security attestation. ProofMode provides cryptographic proof that the content is authentic and has not been tampered with.'
      };
    case 'verified_web':
      return {
        icon: HumanMadeIcon,
        label: 'Human Made',
        className: 'border-brand-blue text-brand-blue-dark dark:text-brand-blue bg-brand-blue-light dark:bg-brand-blue-dark',
        iconColor: 'text-brand-blue-dark dark:text-brand-blue',
        tooltip: 'Human made - valid ProofMode signature',
        description: 'This video was created by a human and has been cryptographically signed with ProofMode. The signature confirms the content has not been altered since creation.'
      };
    case 'basic_proof':
      return {
        icon: ShieldAlert,
        label: 'Basic Proof',
        className: 'border-brand-yellow text-brand-yellow-dark dark:text-brand-yellow bg-brand-yellow-light dark:bg-brand-yellow-dark',
        iconColor: 'text-brand-yellow-dark dark:text-brand-yellow',
        tooltip: 'Basic proof - valid signature, integrity verified',
        description: 'This video includes basic cryptographic proof data. Some verification information is present but it does not meet the full criteria for verified status.'
      };
    case 'unverified':
    default:
      return null;
  }
}
