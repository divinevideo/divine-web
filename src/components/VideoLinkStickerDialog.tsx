// ABOUTME: The dialog a link sticker to a site outside Divine opens before the site itself
// ABOUTME: Shows the link's whole domain and address, as the app's link sheet does; the viewer opens it from there

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, LinkSimple } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { linkDomain } from '@/lib/videoStickerActions';

interface VideoLinkStickerDialogProps {
  /** The http(s) address to show, or null while the dialog is closed. */
  url: string | null;
  onClose: () => void;
}

/**
 * The dialog renders in a portal, but React still bubbles its events through
 * the components it was opened from: the player, which plays or pauses on a
 * click or tap, and the fullscreen feed, which leaves on Escape. They stop here.
 */
function keepFromPlayer(event: SyntheticEvent) {
  event.stopPropagation();
}

/**
 * Where a link sticker goes: the whole domain large, never cut short (a long
 * host hides where it really goes at its end, as in
 * `divine.video.login.example.com`), the address below it, and a link that
 * opens it in a new tab with no opener or referrer.
 */
export function VideoLinkStickerDialog({ url, onClose }: VideoLinkStickerDialogProps) {
  const { t } = useTranslation();
  // Keep the last address while the dialog animates out.
  const [shownUrl, setShownUrl] = useState(url);
  if (url !== null && url !== shownUrl) setShownUrl(url);

  return (
    <div
      className="contents"
      onClick={keepFromPlayer}
      onDoubleClick={keepFromPlayer}
      onTouchStart={keepFromPlayer}
      onTouchMove={keepFromPlayer}
      onTouchEnd={keepFromPlayer}
      onKeyDown={keepFromPlayer}
    >
      <Dialog open={url !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('videoStickers.linkDialogTitle')}</DialogTitle>
            <DialogDescription>{t('videoStickers.linkDialogBody')}</DialogDescription>
          </DialogHeader>
          {shownUrl && (
            <a
              href={shownUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              data-testid="video-link-sticker-open"
              className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <LinkSimple className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block break-all font-semibold text-foreground">{linkDomain(shownUrl)}</span>
                <span className="line-clamp-3 break-all text-sm text-muted-foreground">{shownUrl}</span>
              </span>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </a>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
