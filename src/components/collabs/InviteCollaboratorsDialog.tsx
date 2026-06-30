import { useMemo, useState } from 'react';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useVideoCollaboratorStatus } from '@/hooks/useVideoCollaboratorStatus';
import { useInviteCollaborators } from '@/hooks/useInviteCollaborators';
import { resolveNip05 } from '@/lib/nip05Resolve';
import { coordOf, parsePTagCollaborator } from '@/lib/collabsParser';

interface Pending {
  pubkey: string;
  role?: string;
  label: string;
}

interface Props {
  video: NostrEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteCollaboratorsDialog({ video, open, onOpenChange }: Props) {
  const existing = useMemo(
    () => video.tags
      .map(parsePTagCollaborator)
      .filter((c): c is { pubkey: string; role?: string } => Boolean(c)),
    [video],
  );

  const { data: status } = useVideoCollaboratorStatus(
    coordOf(video),
    existing.map((c) => c.pubkey),
  );

  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = useInviteCollaborators();

  async function add() {
    setError(null);
    if (!handle.trim()) return;
    setResolving(true);
    try {
      let pubkey: string | null = null;
      const trimmed = handle.trim();
      if (trimmed.startsWith('npub1')) {
        try {
          const decoded = nip19.decode(trimmed);
          if (decoded.type === 'npub') pubkey = decoded.data as string;
        } catch { /* fall through */ }
      }
      if (!pubkey) {
        const resolved = await resolveNip05(trimmed);
        if (resolved) pubkey = resolved.pubkey;
      }
      if (!pubkey) {
        setError("Couldn't find that handle.");
        return;
      }
      setPending((p) => [...p, { pubkey, role: role || undefined, label: trimmed }]);
      setHandle('');
      setRole('');
    } finally {
      setResolving(false);
    }
  }

  async function submit() {
    if (pending.length === 0) return;
    await invite.mutateAsync({ original: video, additions: pending });
    setPending([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite collaborators</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h3 className="text-sm font-semibold mb-2">Currently tagged</h3>
            <ul className="space-y-1">
              {existing.length === 0 && (
                <li className="text-sm text-muted-foreground">None yet.</li>
              )}
              {existing.map((c) => (
                <li key={c.pubkey} className="flex items-center gap-2 text-sm">
                  <code className="truncate flex-1">{c.pubkey.slice(0, 12)}…</code>
                  {c.role && <span className="text-muted-foreground">{c.role}</span>}
                  <Badge variant={status?.[c.pubkey] === 'confirmed' ? 'default' : 'secondary'}>
                    {status?.[c.pubkey] ?? 'pending'}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Add collaborator</h3>
            <div className="flex gap-2">
              <Input
                placeholder="@handle.divine.video or npub1…"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                disabled={resolving}
              />
              <Input
                placeholder="role (optional)"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-[140px]"
              />
              <Button onClick={add} disabled={resolving || !handle.trim()}>
                {resolving ? '…' : 'Add'}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            {pending.length > 0 && (
              <ul className="mt-3 space-y-1">
                {pending.map((p) => (
                  <li key={p.pubkey} className="text-sm">
                    <span className="font-medium">{p.label}</span>
                    {p.role && <span className="text-muted-foreground"> · {p.role}</span>}
                    <span className="text-muted-foreground"> — to add</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={pending.length === 0 || invite.isPending}
          >
            {invite.isPending ? 'Republishing…' : 'Republish video'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
