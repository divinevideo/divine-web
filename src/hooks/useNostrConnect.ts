// ABOUTME: Hook for client-initiated NIP-46 nostrconnect:// flow
// ABOUTME: Generates QR code for remote signer apps (Amber, nsec.app)

import { useState, useCallback, useRef, useEffect } from 'react';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { BunkerSigner, createNostrConnectURI } from 'nostr-tools/nip46';
import QRCode from 'qrcode';
import { PROFILE_RELAYS, getRelayUrls } from '@/config/relays';

export type NostrConnectStatus = 'idle' | 'generating' | 'waiting' | 'connected' | 'error' | 'timeout';

export interface NostrConnectState {
  uri: string | null;
  qrCodeUrl: string | null;
  status: NostrConnectStatus;
  error: string | null;
}

export interface NostrConnectResult {
  userPubkey: string;
  bunkerPubkey: string;
  clientNsec: `nsec1${string}`;
  relays: string[];
}

export interface UseNostrConnectOptions {
  timeout?: number;
  relays?: string[];
  appName?: string;
  permissions?: string[];
}

const DEFAULT_TIMEOUT = 300000; // 5 minutes
const DEFAULT_RELAYS = getRelayUrls(PROFILE_RELAYS).slice(0, 3); // First 3 profile relays
const DEFAULT_PERMISSIONS = [
  'sign_event:1',    // Text notes (comments)
  'sign_event:7',    // Reactions (likes)
  'sign_event:6',    // Reposts
  'sign_event:9735', // Zap requests
  'nip44_encrypt',
  'nip44_decrypt',
];

export interface UseNostrConnectReturn {
  state: NostrConnectState;
  generate: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
  onConnect: (callback: (result: NostrConnectResult) => void) => void;
}

export function useNostrConnect(options: UseNostrConnectOptions = {}): UseNostrConnectReturn {
  const {
    timeout = DEFAULT_TIMEOUT,
    relays = DEFAULT_RELAYS,
    appName = 'Divine',
    permissions = DEFAULT_PERMISSIONS,
  } = options;

  const [state, setState] = useState<NostrConnectState>({
    uri: null,
    qrCodeUrl: null,
    status: 'idle',
    error: null,
  });

  const connectCallbackRef = useRef<((result: NostrConnectResult) => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const clientSecretKeyRef = useRef<Uint8Array | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clientSecretKeyRef.current = null;
    setState({
      uri: null,
      qrCodeUrl: null,
      status: 'idle',
      error: null,
    });
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState(prev => ({
      ...prev,
      status: 'idle',
      error: null,
    }));
  }, []);

  const generate = useCallback(async () => {
    // Cancel any existing connection attempt
    abortControllerRef.current?.abort();
    const thisController = new AbortController();
    abortControllerRef.current = thisController;

    setState(prev => ({ ...prev, status: 'generating', error: null }));

    try {
      // Generate ephemeral client keypair
      const clientSecretKey = generateSecretKey();
      clientSecretKeyRef.current = clientSecretKey;
      const clientPubkey = getPublicKey(clientSecretKey);

      // Generate random secret for connection validation
      const secret = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

      // Build nostrconnect:// URI
      const uri = createNostrConnectURI({
        clientPubkey,
        relays,
        secret,
        perms: permissions,
        name: appName,
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(uri, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      setState({
        uri,
        qrCodeUrl,
        status: 'waiting',
        error: null,
      });

      // Listen for connection
      console.log('[useNostrConnect] Waiting for connection...');
      const signer = await BunkerSigner.fromURI(clientSecretKey, uri, {}, timeout);

      // Check if this attempt was cancelled or superseded by a new one
      if (thisController.signal.aborted || abortControllerRef.current !== thisController) {
        return;
      }

      // Get user's public key
      const userPubkey = await signer.getPublicKey();
      const bunkerPubkey = signer.bp.pubkey;
      const clientNsec = nip19.nsecEncode(clientSecretKey) as `nsec1${string}`;

      console.log('[useNostrConnect] Connected! User pubkey:', userPubkey);

      setState(prev => ({
        ...prev,
        status: 'connected',
      }));

      // Call the connect callback
      if (connectCallbackRef.current) {
        connectCallbackRef.current({
          userPubkey,
          bunkerPubkey,
          clientNsec,
          relays,
        });
      }
    } catch (err) {
      // Check if this attempt was cancelled or superseded
      if (thisController.signal.aborted || abortControllerRef.current !== thisController) {
        return;
      }

      const error = err instanceof Error ? err.message : 'Connection failed';
      const isTimeout = error.includes('timed out');

      console.error('[useNostrConnect] Error:', error);

      setState(prev => ({
        ...prev,
        status: isTimeout ? 'timeout' : 'error',
        error,
      }));
    }
  }, [relays, permissions, appName, timeout]);

  const onConnect = useCallback((callback: (result: NostrConnectResult) => void) => {
    connectCallbackRef.current = callback;
  }, []);

  return {
    state,
    generate,
    cancel,
    reset,
    onConnect,
  };
}
