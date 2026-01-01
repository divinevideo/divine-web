// ABOUTME: Toggle component for auto-scroll to the active video in a video feed if idling.

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface AutoScrollToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

export function AutoScrollToggle({ enabled, onToggle, className }: AutoScrollToggleProps) {
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
          <span>Auto-Scroll</span>
        </Label>
      </div>
    </div>
  );
}
