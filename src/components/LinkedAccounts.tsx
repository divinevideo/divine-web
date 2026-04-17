// ABOUTME: Displays NIP-39 external identity links on user profiles
// ABOUTME: Shows platform icons with usernames, click to verify and view proof

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GithubLogo as Github, ArrowSquareOut as ExternalLink, CheckCircle, Warning as AlertTriangle, CircleNotch as Loader2, LinkSimple as Link2, Shield } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  useExternalIdentities,
  verifyIdentityClaim,
  SUPPORTED_PLATFORMS,
  type ExternalIdentity,
} from '@/hooks/useExternalIdentities';
import { getCachedVerification } from '@/lib/verificationCache';
import { API_CONFIG } from '@/config/api';

/** Platform icon mapping */
function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const cn = className || 'h-4 w-4';
  switch (platform) {
    case 'github':
      return <Github className={cn} />;
    case 'twitter':
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'mastodon':
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054 19.648 19.648 0 0 0 4.636.544c.568 0 1.133-.014 1.691-.049 2.298-.146 4.476-.694 4.846-.897C21.012 14.783 21.75 10.248 21.75 9.741v-.378c0-.45.262-3.605-.252-4.05zM18 9.75c0 2.08-.75 3.412-.75 3.412l-.002.006s-.754-1.318-.754-3.418V8.25c0-1.007.315-1.637.756-1.955.433-.31.785-.295.785-.295s.328.01.75.331c.415.32.715.936.715 1.919v1.5zm-9 0c0 2.08-.75 3.412-.75 3.412l-.002.006s-.754-1.318-.754-3.418V8.25c0-1.007.315-1.637.756-1.955.433-.31.785-.295.785-.295s.328.01.75.331c.415.32.715.936.715 1.919v1.5z" />
        </svg>
      );
    case 'telegram':
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      );
    case 'bluesky':
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.643 3.593 3.519 6.178 3.229-3.782.483-7.96 1.692-5.062 5.979 2.56 3.783 4.462 2.05 6.26-1.025 1.612-2.754 2-4.238 2-4.238s.388 1.484 2 4.238c1.798 3.075 3.7 4.808 6.26 1.025 2.898-4.287-1.28-5.496-5.062-5.979 2.585.29 5.393-.586 6.178-3.229C19.622 9.418 20 4.458 20 3.768c0-.689-.139-1.861-.902-2.203-.659-.3-1.664-.62-4.3 1.24C12.046 4.747 9.087 8.686 8 10.8h4z" />
        </svg>
      );
    case 'discord':
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      );
    default:
      return <Link2 className={cn} />;
  }
}

function IdentityBadge({ identity, pubkey }: { identity: ExternalIdentity; pubkey: string }) {
  const [open, setOpen] = useState(false);

  const config = SUPPORTED_PLATFORMS[identity.platform];
  const label = config?.label || identity.platform;

  // Seed from localStorage cache if available (skip stale 'manual' results so they get re-verified)
  const rawCached = identity.proof
    ? getCachedVerification(identity.platform, identity.identity, identity.proof)
    : undefined;
  const cachedResult = rawCached?.error === 'manual' ? undefined : rawCached;

  // Eager verification — runs as soon as proof exists (uses verifyer service for all platforms)
  const verification = useQuery({
    queryKey: ['identity-verify', identity.platform, identity.identity, identity.proof],
    queryFn: () => verifyIdentityClaim(identity, pubkey),
    enabled: !!identity.proof,
    staleTime: 10 * 60 * 1000, // Cache 10 min (re-check periodically)
    gcTime: 30 * 60 * 1000,
    retry: 2,
    initialData: cachedResult ?? undefined,
  });

  // Don't show badge on public profile if verification failed (prevents impersonation display)
  // Show while loading, when verified, or when manual check is needed
  const isVerified = verification.data?.verified;
  const isManual = verification.data?.error === 'manual';
  const isStillLoading = verification.isLoading || verification.fetchStatus === 'idle';
  if (!isVerified && !isManual && !isStillLoading) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          data-testid={`identity-badge-${identity.platform}`}
        >
          <PlatformIcon platform={identity.platform} className="h-3.5 w-3.5" />
          <span className="text-xs">{identity.identity}</span>
          {isVerified && <CheckCircle className="h-3 w-3 text-green-500" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <PlatformIcon platform={identity.platform} className="h-4 w-4" />
            <span className="font-medium text-sm">{label}</span>
          </div>
          <div className="text-sm text-muted-foreground">{identity.identity}</div>

          {/* Verification status */}
          {identity.proof ? (
            <div className="flex items-center gap-1.5 text-xs">
              {verification.isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Verifying...</span>
                </>
              ) : verification.data?.verified ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">Verified</span>
                </>
              ) : verification.data?.error === 'manual' ? (
                <a
                  href={`${API_CONFIG.verificationService.baseUrl}/verify/${encodeURIComponent(identity.platform)}/${encodeURIComponent(identity.identity)}/${encodeURIComponent(identity.proof)}?pubkey=${pubkey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Check proof</span>
                </a>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {verification.data?.error || 'Unverified'}
                  </span>
                </>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="text-xs">No proof</Badge>
          )}

          {/* Links */}
          <div className="flex gap-2 pt-1">
            {identity.profileUrl && (
              <a
                href={identity.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Profile
              </a>
            )}
            {identity.proofUrl && (
              <a
                href={identity.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Proof
              </a>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Note: VerificationSummary is rendered but individual badges hide themselves
// if verification fails, so this just provides context for what's visible
function VerificationSummary({ identities }: { identities: ExternalIdentity[] }) {
  const proofCount = identities.filter((id) => !!id.proof).length;

  if (proofCount === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        >
          <Shield className="h-3.5 w-3.5" />
          <span className="text-xs">Linked accounts</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-1.5">
          <p className="font-medium text-sm">Identity verification</p>
          <p className="text-xs text-muted-foreground">
            Linked accounts are verified using NIP-39 identity proofs.
            Only verified accounts are shown.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface LinkedAccountsProps {
  pubkey: string;
  className?: string;
}

export function LinkedAccounts({ pubkey, className }: LinkedAccountsProps) {
  const { data: identities, isLoading } = useExternalIdentities(pubkey);

  if (isLoading || !identities || identities.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className || ''}`} data-testid="linked-accounts">
      <VerificationSummary identities={identities} />
      {identities.map((identity) => (
        <IdentityBadge
          key={`${identity.platform}:${identity.identity}`}
          identity={identity}
          pubkey={pubkey}
        />
      ))}
    </div>
  );
}
