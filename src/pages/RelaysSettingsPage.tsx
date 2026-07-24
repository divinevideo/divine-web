// ABOUTME: Settings page for managing which relays divine-web connects to
// ABOUTME: Lets users toggle preset relays on/off and add custom relay URLs

import { useState } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { PRESET_RELAYS, toLegacyFormat } from '@/config/relays';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Trash } from '@phosphor-icons/react';
import { useToast } from '@/hooks/useToast';
import { isWssUrl } from '@/lib/relayUrl';

export default function RelaysSettingsPage() {
  const { config, updateConfig } = useAppContext();
  const { toast } = useToast();

  const disabledSet = new Set(config.disabledPresetUrls ?? []);
  const customUrls = config.customRelayUrls ?? [];
  const [newUrl, setNewUrl] = useState('');

  const togglePreset = (url: string, enabled: boolean) => {
    updateConfig((current) => {
      const currentDisabled = current.disabledPresetUrls ?? [];
      const nextDisabled = enabled
        ? currentDisabled.filter((u) => u !== url)
        : [...currentDisabled, url];
      return { ...current, disabledPresetUrls: nextDisabled };
    });
  };

  const addCustom = () => {
    if (!isWssUrl(newUrl)) {
      toast({ title: 'Invalid relay URL. Use wss://...', variant: 'destructive' });
      return;
    }
    if (customUrls.includes(newUrl)) {
      toast({ title: 'Relay already added', variant: 'destructive' });
      return;
    }
    updateConfig((current) => ({
      ...current,
      customRelayUrls: [...(current.customRelayUrls ?? []), newUrl],
    }));
    setNewUrl('');
  };

  const removeCustom = (url: string) => {
    updateConfig((current) => ({
      ...current,
      customRelayUrls: (current.customRelayUrls ?? []).filter((u) => u !== url),
    }));
  };

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Relays</h1>
        <p className="text-sm text-muted-foreground">
          Choose which relays divine-web connects to. Disabled relays are skipped; custom relays are added on top of the presets.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preset relays</CardTitle>
          <CardDescription>Turn off any preset you don't want to use.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {toLegacyFormat(PRESET_RELAYS).map(({ name, url }) => {
            const enabled = !disabledSet.has(url);
            return (
              <div key={url} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{url}</p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => togglePreset(url, checked)}
                  aria-label={`Toggle ${name}`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom relays</CardTitle>
          <CardDescription>Add a relay URL not in the preset list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customUrls.map((url) => (
            <div key={url} className="flex items-center justify-between">
              <p className="text-sm break-all">{url}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCustom(url)}
                aria-label={`Remove ${url}`}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="custom-relay-url">Relay URL</Label>
              <Input
                id="custom-relay-url"
                placeholder="wss://relay.example.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <Button onClick={addCustom}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
