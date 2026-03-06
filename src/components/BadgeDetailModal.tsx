// ABOUTME: Modal showing full badge details - image, name, description, issuer, award date
// ABOUTME: Shown when clicking a badge on a profile or in the feed

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuthor } from '@/hooks/useAuthor';
import { getBadgeImageUrl, type ValidatedBadge } from '@/lib/badges';
import { Award } from 'lucide-react';

interface BadgeDetailModalProps {
  badge: ValidatedBadge | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BadgeDetailModal({ badge, open, onOpenChange }: BadgeDetailModalProps) {
  const issuerAuthor = useAuthor(badge?.definition.issuerPubkey);
  const issuerName = issuerAuthor.data?.metadata?.display_name
    || issuerAuthor.data?.metadata?.name
    || badge?.definition.issuerPubkey.slice(0, 12) + '...';
  const issuerAvatar = issuerAuthor.data?.metadata?.picture;

  if (!badge) return null;

  const { definition, awardedAt } = badge;
  const imageUrl = getBadgeImageUrl(definition, 256) || getBadgeImageUrl(definition, 1024);
  const awardDate = new Date(awardedAt * 1000);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Badge Details
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Badge Image */}
          {imageUrl && (
            <div className={`relative rounded-lg overflow-hidden ${
              definition.isOfficial
                ? 'ring-2 ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                : ''
            }`}>
              <img
                src={imageUrl}
                alt={definition.name}
                className="w-32 h-32 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Badge Name */}
          <div className="text-center">
            <h3 className="text-lg font-bold">{definition.name}</h3>
            {definition.isOfficial && (
              <Badge variant="outline" className="mt-1 border-yellow-400 text-yellow-600 dark:text-yellow-400">
                ✦ Official Divine Badge
              </Badge>
            )}
          </div>

          {/* Description */}
          {definition.description && (
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {definition.description}
            </p>
          )}

          {/* Issuer & Date */}
          <div className="w-full space-y-3 pt-2 border-t">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-16">Issued by</span>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={issuerAvatar} alt={issuerName} />
                  <AvatarFallback className="text-xs">
                    {issuerName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{issuerName}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-16">Awarded</span>
              <span className="text-sm">
                {awardDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
