// ABOUTME: Component for selecting and switching between Nostr relays
// ABOUTME: Provides a dropdown UI to change the active relay connection

import { useAppContext } from '@/hooks/useAppContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRESET_RELAYS, toLegacyFormat } from '@/config/relays';

interface RelaySelectorProps {
  className?: string;
  contentClassName?: string;
}

export function RelaySelector({ className, contentClassName }: RelaySelectorProps) {
  const { config, updateConfig, presetRelays } = useAppContext();

  const handleRelayChange = (newRelayUrl: string) => {
    updateConfig((currentConfig) => ({
      ...currentConfig,
      relayUrl: newRelayUrl,
    }));
  };

  // Use preset relays from context if available, otherwise use centralized defaults
  const relays = presetRelays || toLegacyFormat(PRESET_RELAYS);

  return (
    <Select value={config.relayUrl} onValueChange={handleRelayChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select relay" />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {relays.map(({ name, url }) => (
          <SelectItem key={url} value={url}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
