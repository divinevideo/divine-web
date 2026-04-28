import type { NostrEvent } from '@nostrify/nostrify';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { dTagOf, parsePTagCollaborator } from '@/lib/collabsParser';

interface Props {
  video: NostrEvent;
  myPubkey: string;
  approving: boolean;
  onApprove: (args: { creatorPubkey: string; videoDTag: string }) => void;
}

export function PendingInviteCard({ video, myPubkey, approving, onApprove }: Props) {
  const title = video.tags.find((t) => t[0] === 'title')?.[1] ?? 'Untitled';
  const myPTag = video.tags
    .map(parsePTagCollaborator)
    .find((c) => c?.pubkey === myPubkey);
  const role = myPTag?.role ?? 'Collaborator';

  return (
    <Card className="flex items-start gap-4 p-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">{role}</p>
        <p className="font-semibold truncate">{title}</p>
      </div>
      <Button
        variant="outline"
        aria-label="Approve"
        disabled={approving}
        onClick={() => onApprove({
          creatorPubkey: video.pubkey,
          videoDTag: dTagOf(video),
        })}
      >
        {approving ? 'Approving…' : 'Approve'}
      </Button>
    </Card>
  );
}
