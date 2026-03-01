// ABOUTME: Settings page for NIP-39 external identity verification (linked accounts)
// ABOUTME: Manage linked platform accounts (GitHub, Twitter, Mastodon, Telegram) with proof verification

import { useState, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useExternalIdentities, SUPPORTED_PLATFORMS, verifyIdentityClaim, type ExternalIdentity } from '@/hooks/useExternalIdentities';
import { useAddIdentity, useRemoveIdentity } from '@/hooks/usePublishIdentity';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Link2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Github,
  MessageCircle,
  AtSign,
  Shield,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { nip19 } from 'nostr-tools';

// X/Twitter icon (simple)
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  github: <Github className="h-5 w-5" />,
  twitter: <XIcon className="h-5 w-5" />,
  mastodon: <AtSign className="h-5 w-5" />,
  telegram: <MessageCircle className="h-5 w-5" />,
};

const PROOF_PLACEHOLDERS: Record<string, string> = {
  github: 'Gist ID (e.g. abc123def456)',
  twitter: 'Tweet ID (e.g. 1234567890)',
  mastodon: 'Post ID (e.g. 109876543210)',
  telegram: 'Message link path (e.g. username/123)',
};

const IDENTITY_PLACEHOLDERS: Record<string, string> = {
  github: 'GitHub username',
  twitter: 'Twitter/X username',
  mastodon: 'user@instance.social',
  telegram: 'Telegram username',
};

function VerificationBadge({ identity, pubkey }: { identity: ExternalIdentity; pubkey: string }) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'verified' | 'failed'>('idle');
  const [error, setError] = useState<string>();

  const verify = useCallback(async () => {
    setStatus('checking');
    const result = await verifyIdentityClaim(identity, pubkey);
    if (result.verified) {
      setStatus('verified');
    } else {
      setStatus('failed');
      setError(result.error);
    }
  }, [identity, pubkey]);

  if (!identity.proof) {
    return (
      <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300">
        <AlertTriangle className="h-3 w-3" />
        No proof
      </Badge>
    );
  }

  switch (status) {
    case 'idle':
      return (
        <Button variant="ghost" size="sm" onClick={verify} className="h-6 text-xs">
          Verify
        </Button>
      );
    case 'checking':
      return (
        <Badge variant="outline" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking…
        </Badge>
      );
    case 'verified':
      return (
        <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
          <CheckCircle2 className="h-3 w-3" />
          Verified
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300" title={error}>
          <AlertTriangle className="h-3 w-3" />
          Unverified
        </Badge>
      );
  }
}

function LinkedAccountItem({
  identity,
  pubkey,
  onRemove,
  removing,
}: {
  identity: ExternalIdentity;
  pubkey: string;
  onRemove: () => void;
  removing: boolean;
}) {
  const config = SUPPORTED_PLATFORMS[identity.platform];
  const icon = PLATFORM_ICONS[identity.platform] ?? <Link2 className="h-5 w-5" />;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{identity.identity}</p>
            <Badge variant="secondary" className="text-xs">
              {config?.label ?? identity.platform}
            </Badge>
            <VerificationBadge identity={identity} pubkey={pubkey} />
          </div>
          <div className="flex gap-2 mt-1">
            {identity.profileUrl && (
              <a
                href={identity.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
              >
                Profile <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {identity.proofUrl && (
              <a
                href={identity.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
              >
                Proof <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove} disabled={removing}>
        {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function LinkedAccountsSettingsPage() {
  const { user } = useCurrentUser();
  const { data: identities = [], isLoading } = useExternalIdentities(user?.pubkey);
  const addIdentity = useAddIdentity();
  const removeIdentity = useRemoveIdentity();
  const { toast } = useToast();

  const [platform, setPlatform] = useState('github');
  const [identity, setIdentity] = useState('');
  const [proof, setProof] = useState('');
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const npub = user ? nip19.npubEncode(user.pubkey) : '';
  const selectedConfig = SUPPORTED_PLATFORMS[platform];

  const handleAdd = async () => {
    if (!identity.trim()) {
      toast({ title: 'Error', description: 'Please enter your username/identity', variant: 'destructive' });
      return;
    }
    if (!proof.trim()) {
      toast({ title: 'Error', description: 'Please enter the proof ID', variant: 'destructive' });
      return;
    }

    try {
      await addIdentity.mutateAsync({ platform, identity: identity.trim(), proof: proof.trim() });
      toast({ title: 'Linked', description: `${selectedConfig?.label ?? platform} account linked successfully` });
      setIdentity('');
      setProof('');
    } catch {
      toast({ title: 'Error', description: 'Failed to publish identity event', variant: 'destructive' });
    }
  };

  const handleRemove = async (id: ExternalIdentity) => {
    const key = `${id.platform}:${id.identity}`;
    setRemovingKey(key);
    try {
      await removeIdentity.mutateAsync({ platform: id.platform, identity: id.identity });
      toast({ title: 'Removed', description: 'Account unlinked' });
    } catch {
      toast({ title: 'Error', description: 'Failed to remove identity', variant: 'destructive' });
    } finally {
      setRemovingKey(null);
    }
  };

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Authentication Required</p>
            <p className="text-muted-foreground">Please log in to manage your linked accounts</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <Link2 className="h-8 w-8" />
          Linked Accounts
        </h1>
        <p className="text-muted-foreground">
          Verify your identity across platforms using{' '}
          <a
            href="https://github.com/nostr-protocol/nips/blob/master/39.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            NIP-39
          </a>
        </p>
      </div>

      {/* Current Linked Accounts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Your Linked Accounts ({identities.length})
          </CardTitle>
          <CardDescription>
            Accounts linked to your Nostr identity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : identities.length > 0 ? (
            <div className="space-y-2">
              {identities.map((id) => (
                <LinkedAccountItem
                  key={`${id.platform}:${id.identity}`}
                  identity={id}
                  pubkey={user.pubkey}
                  onRemove={() => handleRemove(id)}
                  removing={removingKey === `${id.platform}:${id.identity}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No linked accounts yet. Add one below!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add New Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Link a New Account
          </CardTitle>
          <CardDescription>
            Prove you own an account on another platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Select platform */}
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SUPPORTED_PLATFORMS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {PLATFORM_ICONS[key]}
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Enter username */}
          <div className="space-y-2">
            <Label>Username / Identity</Label>
            <Input
              placeholder={IDENTITY_PLACEHOLDERS[platform] ?? 'Username'}
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            />
          </div>

          {/* Step 3: Instructions */}
          <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="py-4">
              <p className="text-sm font-medium mb-2">Step 1: Create a proof post</p>
              <p className="text-sm text-muted-foreground mb-3">
                {platform === 'github' && 'Create a public GitHub Gist containing:'}
                {platform === 'twitter' && 'Post a tweet containing:'}
                {platform === 'mastodon' && 'Post a toot containing:'}
                {platform === 'telegram' && 'Send a message containing:'}
              </p>
              <code className="block p-3 bg-muted rounded text-xs break-all select-all">
                {selectedConfig?.verificationText(npub)[0] ?? npub}
              </code>
              <p className="text-sm font-medium mt-4 mb-2">Step 2: Enter the proof ID below</p>
            </CardContent>
          </Card>

          {/* Step 4: Proof ID */}
          <div className="space-y-2">
            <Label>Proof ID</Label>
            <Input
              placeholder={PROOF_PLACEHOLDERS[platform] ?? 'Proof identifier'}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
            />
          </div>

          <Button
            onClick={handleAdd}
            disabled={!identity.trim() || !proof.trim() || addIdentity.isPending}
            className="w-full"
          >
            {addIdentity.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Verify & Save
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
