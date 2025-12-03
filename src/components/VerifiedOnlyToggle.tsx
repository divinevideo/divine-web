// ABOUTME: Toggle component for filtering to show only verified videos
// ABOUTME: Allows users to filter feeds to show only ProofMode verified content

import { CheckCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface VerifiedOnlyToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

export function VerifiedOnlyToggle({ enabled, onToggle, className }: VerifiedOnlyToggleProps) {
  return (
    <div className={className}>
      <div className="flex items-center space-x-2">
        <Switch
          id="verified-only"
          checked={enabled}
          onCheckedChange={onToggle}
        />
        <Label
          htmlFor="verified-only"
          className="flex items-center gap-2 cursor-pointer text-sm text-foreground"
        >
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span>Human Made</span>
        </Label>
      </div>
      {enabled && (
        <p className="text-xs text-muted-foreground mt-2">
          Showing only videos with ProofMode verification
        </p>
      )}
    </div>
  );
}
