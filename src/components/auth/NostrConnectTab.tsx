// ABOUTME: UI component for nostrconnect:// QR code login flow
// ABOUTME: Displays QR code for remote signer apps with fallback bunker:// paste

import { useState, useEffect } from 'react';
import { Copy, Check, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { useNostrConnect, type NostrConnectResult } from '@/hooks/useNostrConnect';
import { useLoginActions } from '@/hooks/useLoginActions';

interface NostrConnectTabProps {
  onConnect: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function NostrConnectTab({ onConnect, isLoading, setIsLoading }: NostrConnectTabProps) {
  const { toast } = useToast();
  const login = useLoginActions();
  const { state, generate, cancel, reset, onConnect: setConnectCallback } = useNostrConnect();
  const [copied, setCopied] = useState(false);
  const [showBunkerFallback, setShowBunkerFallback] = useState(false);
  const [bunkerUri, setBunkerUri] = useState('');
  const [bunkerError, setBunkerError] = useState<string | null>(null);

  // Set up connect callback
  useEffect(() => {
    setConnectCallback((result: NostrConnectResult) => {
      // Create login with the connection result
      login.nostrconnect(
        result.clientNsec,
        result.bunkerPubkey,
        result.userPubkey,
        result.relays
      );
      onConnect();
    });
  }, [setConnectCallback, login, onConnect]);

  // Generate QR code on mount
  useEffect(() => {
    if (state.status === 'idle') {
      generate();
    }
  }, [state.status, generate]);

  // Update parent loading state
  useEffect(() => {
    setIsLoading(state.status === 'waiting' || state.status === 'generating');
  }, [state.status, setIsLoading]);

  // Reset when unmounting
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const handleCopy = async () => {
    if (state.uri) {
      await navigator.clipboard.writeText(state.uri);
      setCopied(true);
      toast({
        title: 'Copied',
        description: 'Connection URI copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRetry = () => {
    generate();
  };

  const handleCancel = () => {
    cancel();
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setBunkerError('Please enter a bunker URI');
      return;
    }

    if (!bunkerUri.startsWith('bunker://')) {
      setBunkerError('Invalid bunker URI format. Must start with bunker://');
      return;
    }

    setBunkerError(null);
    setIsLoading(true);

    try {
      await login.bunker(bunkerUri);
      onConnect();
      setBunkerUri('');
    } catch (err) {
      console.error('Bunker login failed:', err);
      setBunkerError('Failed to connect to bunker. Please check the URI.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* QR Code Section */}
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Scan with your remote signer app
        </p>

        {/* QR Code */}
        <div className="flex justify-center">
          <Card className="p-3 max-w-[280px] mx-auto bg-white">
            <CardContent className="p-0 flex justify-center items-center aspect-square">
              {state.status === 'generating' ? (
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              ) : state.qrCodeUrl ? (
                <img
                  src={state.qrCodeUrl}
                  alt="Nostr Connect QR Code"
                  className="w-full h-auto aspect-square object-contain"
                />
              ) : (
                <div className="text-muted-foreground text-sm">
                  Failed to generate QR code
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Messages */}
        {state.status === 'waiting' && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Waiting for connection...</span>
          </div>
        )}

        {state.status === 'connected' && (
          <div className="flex items-center justify-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            <span>Connected!</span>
          </div>
        )}

        {/* Error/Timeout Messages */}
        {(state.status === 'error' || state.status === 'timeout') && (
          <Alert variant="destructive" className="text-left">
            <AlertDescription>
              {state.status === 'timeout'
                ? 'Connection timed out. Make sure your signer app is open and try again.'
                : state.error || 'Connection failed'}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-2">
          {state.status === 'waiting' && (
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          {(state.status === 'error' || state.status === 'timeout') && (
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>

        {/* Copy URI Section */}
        {state.uri && state.status !== 'error' && state.status !== 'timeout' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Or copy this link:</Label>
            <div className="flex gap-2">
              <Input
                value={state.uri}
                readOnly
                className="text-xs font-mono bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bunker Fallback Section */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowBunkerFallback(!showBunkerFallback)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full justify-center"
        >
          {showBunkerFallback ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          <span>Or paste a bunker:// URI</span>
        </button>

        {showBunkerFallback && (
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="bunkerUri" className="text-sm font-medium">
                Bunker URI
              </Label>
              <Input
                id="bunkerUri"
                value={bunkerUri}
                onChange={(e) => {
                  setBunkerUri(e.target.value);
                  if (bunkerError) setBunkerError(null);
                }}
                className={bunkerError ? 'border-red-500' : ''}
                placeholder="bunker://"
                disabled={isLoading}
              />
              {bunkerError && (
                <p className="text-sm text-red-500">{bunkerError}</p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleBunkerLogin}
              disabled={isLoading || !bunkerUri.trim()}
            >
              {isLoading ? 'Connecting...' : 'Connect with Bunker'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NostrConnectTab;
