import type { NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { dTagOf, parsePTagCollaborator } from '@/lib/collabsParser';
import { buildProfileLinkPath } from '@/lib/profileLinks';
import { buildResolvedEventRoute } from '@/lib/eventRouting';

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
  const creatorNpub = nip19.npubEncode(video.pubkey);
  const creatorLabel = `${creatorNpub.slice(0, 12)}...`;

  return (
    <Card className="flex items-start gap-4 p-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{role}</span>
          <Link
            to={buildProfileLinkPath({ pubkey: video.pubkey })}
            className="underline-offset-2 hover:underline"
          >
            Creator {creatorLabel}
          </Link>
        </div>
        <Link
          to={buildResolvedEventRoute(video)}
          className="block truncate font-semibold underline-offset-2 hover:underline"
        >
          {title}
        </Link>
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
