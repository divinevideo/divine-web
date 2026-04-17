// ABOUTME: Embed code generator page for Divine video widget
// ABOUTME: Lets users configure and preview an embeddable iframe for their profile

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Check, Code } from '@phosphor-icons/react';
import { MarketingLayout } from '@/components/MarketingLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Theme = 'dark' | 'light';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const COUNT_OPTIONS = [1, 2, 3, 4, 5];

const REFRESH_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 0, label: 'Never' },
];

function computeHeight(count: number): number {
  return 200 + count * 180;
}

export function GetEmbedPage() {
  const [searchParams] = useSearchParams();
  const [npub, setNpub] = useState(searchParams.get('npub') || '');
  const [theme, setTheme] = useState<Theme>('dark');
  const [count, setCount] = useState(1);
  const [autorefresh, setAutorefresh] = useState(60);
  const [copied, setCopied] = useState(false);

  const isValidNpub = npub.startsWith('npub1') && npub.length > 10;

  const embedUrl = useMemo(() => {
    if (!isValidNpub) return '';
    const params = new URLSearchParams();
    params.set('npub', npub);
    params.set('theme', theme);
    params.set('count', String(count));
    if (autorefresh !== 60) params.set('autorefresh', String(autorefresh));
    return params.toString();
  }, [npub, theme, count, autorefresh, isValidNpub]);

  const height = computeHeight(count);

  const embedSnippet = useMemo(() => {
    if (!embedUrl) return '';
    return `<iframe
  src="https://divine.video/embed?${embedUrl}"
  width="350"
  height="${height}"
  style="border-radius: 12px; border: none;"
  title="Divine Video Widget"
></iframe>`;
  }, [embedUrl, height]);

  const handleCopy = useCallback(async () => {
    if (!embedSnippet) return;
    await navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
  }, [embedSnippet]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-2">
          <Code className="h-8 w-8 text-brand-green" />
          <h1 className="text-4xl font-bold">Embed Divine Widget</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Add your latest Divine videos to any website or blog sidebar.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="npub-input">Your npub (Nostr public key)</Label>
                  <Input
                    id="npub-input"
                    type="text"
                    placeholder="npub1..."
                    value={npub}
                    onChange={(e) => setNpub(e.target.value.trim())}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme-select">Theme</Label>
                    <select
                      id="theme-select"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as Theme)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {THEME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="count-select">Videos</Label>
                    <select
                      id="count-select"
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {COUNT_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="refresh-select">Auto-refresh</Label>
                    <select
                      id="refresh-select"
                      value={autorefresh}
                      onChange={(e) => setAutorefresh(Number(e.target.value))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {REFRESH_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Embed code */}
            {isValidNpub && (
              <Card>
                <CardHeader>
                  <CardTitle>Embed Code</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
                      {embedSnippet}
                    </pre>
                    <Button
                      size="sm"
                      variant={copied ? 'secondary' : 'default'}
                      className="absolute top-2 right-2"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Live preview */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-4 flex justify-center min-h-[200px] items-center">
                  {isValidNpub ? (
                    <iframe
                      src={`/embed?${embedUrl}`}
                      width="350"
                      height={height}
                      style={{ border: 'none', borderRadius: '12px' }}
                      title="Divine Video Widget Preview"
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Enter your npub above to see a preview
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default GetEmbedPage;
