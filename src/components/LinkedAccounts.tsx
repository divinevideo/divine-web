// ABOUTME: Displays NIP-39 external identity links on user profiles
// ABOUTME: Shows platform icons with usernames, click to verify and view proof

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Github, ExternalLink, CheckCircle, AlertTriangle, Loader2, Link2 } from 'lucide-react';
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
    default:
      return <Link2 className={cn} />;
  }
}

function IdentityBadge({ identity, pubkey }: { identity: ExternalIdentity; pubkey: string }) {
  const [open, setOpen] = useState(false);

  const config = SUPPORTED_PLATFORMS[identity.platform];
  const label = config?.label || identity.platform;

  // Lazy verification — only runs when popover opens
  const verification = useQuery({
    queryKey: ['identity-verify', identity.platform, identity.identity, identity.proof],
    queryFn: () => verifyIdentityClaim(identity, pubkey),
    enabled: open && !!identity.proof,
    staleTime: 60 * 60 * 1000, // Cache 1 hour
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1,
  });

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
                  <span className="text-muted-foreground">Verifying…</span>
                </>
              ) : verification.data?.verified ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">Verified</span>
                </>
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

interface LinkedAccountsProps {
  pubkey: string;
  className?: string;
}

export function LinkedAccounts({ pubkey, className }: LinkedAccountsProps) {
  const { data: identities, isLoading } = useExternalIdentities(pubkey);

  if (isLoading || !identities || identities.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className || ''}`} data-testid="linked-accounts">
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
