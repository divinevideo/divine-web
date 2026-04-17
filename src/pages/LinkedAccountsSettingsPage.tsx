// ABOUTME: Settings page for NIP-39 external identity verification (linked accounts)
// ABOUTME: Manage linked platform accounts (GitHub, Twitter, Mastodon, Telegram) with proof verification

import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useExternalIdentities, SUPPORTED_PLATFORMS, verifyIdentityClaim, type ExternalIdentity } from '@/hooks/useExternalIdentities';
import { useAddIdentity, useRemoveIdentity } from '@/hooks/usePublishIdentity';
import { API_CONFIG } from '@/config/api';
import { getDivineNip05Info } from '@/lib/nip05Utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkSimple as Link2, Plus, Trash as Trash2, PencilSimple as Pencil, CheckCircle as CheckCircle2, Warning as AlertTriangle, CircleNotch as Loader2, ArrowSquareOut as ExternalLink, GithubLogo as Github, ChatCircle as MessageCircle, At as AtSign, Shield, Copy, Check, X, ArrowLeft } from '@phosphor-icons/react';
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

// Bluesky butterfly icon
function BlueskyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.643 3.593 3.519 6.178 3.229-3.782.483-7.96 1.692-5.062 5.979 2.56 3.783 4.462 2.05 6.26-1.025 1.612-2.754 2-4.238 2-4.238s.388 1.484 2 4.238c1.798 3.075 3.7 4.808 6.26 1.025 2.898-4.287-1.28-5.496-5.062-5.979 2.585.29 5.393-.586 6.178-3.229C19.622 9.418 20 4.458 20 3.768c0-.689-.139-1.861-.902-2.203-.659-.3-1.664-.62-4.3 1.24C12.046 4.747 9.087 8.686 8 10.8h4z" />
    </svg>
  );
}

// Discord icon
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  github: <Github className="h-5 w-5" />,
  twitter: <XIcon className="h-5 w-5" />,
  mastodon: <AtSign className="h-5 w-5" />,
  telegram: <MessageCircle className="h-5 w-5" />,
  bluesky: <BlueskyIcon className="h-5 w-5" />,
  discord: <DiscordIcon className="h-5 w-5" />,
};

const PROOF_PLACEHOLDERS: Record<string, string> = {
  github: 'https://gist.github.com/you/abc123',
  twitter: 'https://x.com/you/status/123456789',
  mastodon: 'https://mastodon.social/@you/123456789',
  telegram: 'https://t.me/channelname/123',
  bluesky: 'https://bsky.app/profile/you/post/abc123',
  discord: 'https://discord.gg/AbCdEf',
};

/** Extract identity and proof from a URL, or return input as proof only */
function extractFromUrl(platform: string, input: string): { identity?: string; proof: string } {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    switch (platform) {
      case 'github':
        // https://gist.github.com/USER/GIST_ID
        if (url.hostname.includes('gist.github.com') && parts.length >= 2) {
          return { identity: parts[0], proof: parts[1] };
        }
        return { proof: parts.pop() || trimmed };
      case 'twitter':
        // https://twitter.com/USER/status/TWEET_ID or https://x.com/USER/status/TWEET_ID
        if (parts.length >= 3 && parts[1] === 'status') {
          return { identity: parts[0], proof: parts[2] };
        }
        return { proof: parts.pop() || trimmed };
      case 'mastodon':
        // https://instance/@user/POST_ID
        if (parts.length >= 2 && parts[0].startsWith('@')) {
          return { identity: `${url.hostname}/${parts[0]}`, proof: parts[1] };
        }
        return { proof: parts.pop() || trimmed };
      case 'bluesky':
        // https://bsky.app/profile/USER/post/RKEY
        if (parts.length >= 4 && parts[0] === 'profile' && parts[2] === 'post') {
          return { identity: parts[1], proof: parts[3] };
        }
        return { proof: parts.pop() || trimmed };
      case 'telegram':
        // https://t.me/channel/123 → identity=channel, proof=channel/123
        if (parts.length >= 2) {
          return { identity: parts[0], proof: parts.join('/') };
        }
        if (parts.length === 1) {
          return { identity: parts[0], proof: parts[0] };
        }
        return { proof: url.pathname.slice(1) || trimmed };
      case 'discord':
        // https://discord.gg/CODE → identity=CODE (invite), proof=CODE
        {
          const code = parts.pop() || trimmed;
          return { identity: code, proof: code };
        }
      default:
        return { proof: trimmed };
    }
  } catch {
    return { proof: trimmed };
  }
}

const PROOF_INSTRUCTIONS: Record<string, string> = {
  github: 'Create a public GitHub Gist containing the text below, then paste the Gist ID.',
  twitter: 'Post a tweet containing the text below, then paste the Tweet ID from the URL.',
  mastodon: 'Post a toot containing the text below, then paste the Post ID from the URL.',
  telegram: 'Send a message in a public channel/group containing the text below, then paste the message path (e.g. channelname/123).',
  bluesky: 'Post on Bluesky containing the text below, then paste the record key (rkey) from the post URL.',
  discord: 'Create a Discord server with your npub in the server name or description, then create a permanent invite link and paste the invite code.',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}

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

  // Auto-verify when a proof is present or changes.
  useEffect(() => {
    if (identity.proof) {
      void verify();
    }
  }, [identity.proof, verify]);

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
          Checking...
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
      return error === 'manual' ? (
        <a
          href={`${API_CONFIG.verificationService.baseUrl}/verify/${encodeURIComponent(identity.platform)}/${encodeURIComponent(identity.identity)}/${encodeURIComponent(identity.proof)}?pubkey=${pubkey}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          Check proof
        </a>
      ) : (
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
  onEdit,
  removing,
}: {
  identity: ExternalIdentity;
  pubkey: string;
  onRemove: () => void;
  onEdit: () => void;
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
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit} title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove} disabled={removing} title="Remove">
          {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function LinkedAccountsSettingsPage() {
  const { user, metadata } = useCurrentUser();
  const { data: identities = [], isLoading } = useExternalIdentities(user?.pubkey);
  const addIdentity = useAddIdentity();
  const removeIdentity = useRemoveIdentity();
  const { toast } = useToast();

  const [platform, setPlatform] = useState('github');
  const [identity, setIdentity] = useState('');
  const [proof, setProof] = useState('');
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [editingIdentity, setEditingIdentity] = useState<ExternalIdentity | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const npub = user ? nip19.npubEncode(user.pubkey) : '';
  const selectedConfig = SUPPORTED_PLATFORMS[platform];
  const divineInfo = metadata?.nip05 ? getDivineNip05Info(metadata.nip05) : null;
  const profileLink = divineInfo?.href || `https://divine.video/profile/${npub}`;
  const verificationText = selectedConfig
    ? `I'm on divine.video, find me at: ${profileLink}\n\nThis serves to verify connecting this account with my divine account: ${npub}`
    : npub;
  // Build compose URL with the correct profile link (divine NIP-05 or npub)
  const createProofUrl = (() => {
    if (!selectedConfig?.createProofUrl) return undefined;
    if (platform === 'twitter') {
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I'm on @divinevideoapp, find me at: ${profileLink}\n\nThis serves to verify connecting this account with my divine account: ${npub}`)}`;
    }
    if (platform === 'bluesky') {
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(`I'm on divine.video, find me at: ${profileLink}\n\nThis serves to verify connecting this account with my divine account: ${npub}`)}`;
    }
    return selectedConfig.createProofUrl(identity.trim(), npub);
  })();

  const handleEdit = (id: ExternalIdentity) => {
    setEditingIdentity(id);
    setPlatform(id.platform);
    setIdentity(id.identity);
    setProof(id.proof);
    // Scroll to form
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleCancelEdit = () => {
    setEditingIdentity(null);
    setPlatform('github');
    setIdentity('');
    setProof('');
  };

  const handleAdd = async () => {
    if (!proof.trim()) {
      toast({ title: 'Error', description: 'Please enter the proof URL or ID', variant: 'destructive' });
      return;
    }

    try {
      const extracted = extractFromUrl(platform, proof);
      const cleanProof = extracted.proof;
      // Use extracted identity, or state identity, or fall back to proof itself for Telegram/Discord
      const cleanIdentity = extracted.identity || identity.trim() || cleanProof;
      if (!cleanIdentity) {
        toast({ title: 'Error', description: 'Could not determine username from the URL', variant: 'destructive' });
        return;
      }
      await addIdentity.mutateAsync({ platform, identity: cleanIdentity, proof: cleanProof });
      const action = editingIdentity ? 'Updated' : 'Linked';

      // Auto-verify the newly linked identity
      const newIdentity: ExternalIdentity = {
        platform,
        identity: cleanIdentity,
        proof: cleanProof,
        profileUrl: selectedConfig?.profileUrl(cleanIdentity) ?? '',
        proofUrl: selectedConfig?.proofUrl(cleanIdentity, cleanProof) ?? '',
      };
      const verifyResult = await verifyIdentityClaim(newIdentity, user!.pubkey);
      if (verifyResult.verified) {
        toast({ title: 'Verified!', description: `${selectedConfig?.label ?? platform} account ${action.toLowerCase()} and verified` });
      } else {
        toast({ title: action, description: `${selectedConfig?.label ?? platform} account ${action.toLowerCase()} — check your proof post to verify` });
      }

      setIdentity('');
      setProof('');
      setEditingIdentity(null);
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
        <Link
          to={`/profile/${nip19.npubEncode(user.pubkey)}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
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
                  onEdit={() => handleEdit(id)}
                  removing={removingKey === `${id.platform}:${id.identity}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No accounts linked yet. Connect one below and claim your name.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Account */}
      <Card ref={formRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editingIdentity ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {editingIdentity ? 'Edit Linked Account' : 'Link a New Account'}
          </CardTitle>
          <CardDescription>
            {editingIdentity ? 'Update the proof for this account' : 'Prove you own an account on another platform'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Select platform */}
          <div className="space-y-3">
            <Label>Platform</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Object.entries(SUPPORTED_PLATFORMS).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { if (!editingIdentity) { setPlatform(key); setIdentity(''); setProof(''); } }}
                  disabled={!!editingIdentity}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                    platform === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-primary/50 hover:bg-muted/50 text-muted-foreground'
                  } ${editingIdentity ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="h-8 w-8 flex items-center justify-center [&>svg]:h-8 [&>svg]:w-8">
                    {PLATFORM_ICONS[key]}
                  </div>
                  <span className="text-xs font-medium">{config.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="py-4">
              <p className="text-sm font-medium mb-2">Step 1: Create a proof post</p>
              <p className="text-sm text-muted-foreground mb-3">
                {PROOF_INSTRUCTIONS[platform]}
              </p>
              <div className="relative">
                <code className="block p-3 pr-20 bg-muted rounded text-xs break-all whitespace-pre-wrap">
                  {verificationText}
                </code>
                <div className="absolute top-1 right-1">
                  <CopyButton text={verificationText} />
                </div>
              </div>

              {createProofUrl && (
                <div className="mt-3">
                  <a
                    href={createProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {platform === 'github' && 'Create a new Gist'}
                    {platform === 'twitter' && 'Post on Twitter/X'}
                    {platform === 'bluesky' && 'Post on Bluesky'}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Paste proof link */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Step 2: Paste the proof link</Label>
            <Input
              placeholder={PROOF_PLACEHOLDERS[platform] ?? 'Paste the full URL'}
              value={proof}
              onChange={(e) => {
                const val = e.target.value;
                setProof(val);
                // Auto-extract identity from URL
                const extracted = extractFromUrl(platform, val);
                if (extracted.identity) {
                  setIdentity(extracted.identity);
                }
              }}
            />
            {identity && (
              <p className="text-xs text-green-600">
                Detected: <span className="font-medium">{identity}</span>
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {editingIdentity && (
              <Button variant="outline" onClick={handleCancelEdit} className="flex-shrink-0">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button
              onClick={handleAdd}
              disabled={!proof.trim() || addIdentity.isPending}
              className="w-full"
            >
              {addIdentity.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : editingIdentity ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Update Account
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Link Account
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
