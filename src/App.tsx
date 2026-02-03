/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from '@unhead/react/client';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { Suspense } from 'react';
import NostrProvider from '@/components/NostrProvider';
import { EventCachePreloader } from '@/components/EventCachePreloader';
import { KeycastJWTWindowNostr } from '@/components/KeycastJWTWindowNostr';
import { SentryUserSync } from '@/components/SentryUserSync';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from '@nostrify/react/login';
import { AppProvider } from '@/components/AppProvider';
import { NWCProvider } from '@/contexts/NWCContext';
import { AppConfig } from '@/contexts/AppContext';
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext';
import { FullscreenFeedProvider } from '@/contexts/FullscreenFeedContext';
import AppRouter from './AppRouter';
import { PRIMARY_RELAY, PRESET_RELAYS, toLegacyFormat } from '@/config/relays';

const head = createHead({
  plugins: [
    InferSeoMetaPlugin(),
  ],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: 300000, // 5 minutes - don't cache forever, allows recovery from failed queries
    },
  },
});

const defaultConfig: AppConfig = {
  theme: "system",
  relayUrl: PRIMARY_RELAY.url, // Primary relay with NIP-50 support
  relayUrls: [
    'wss://relay.divine.video',
  ],
};

const presetRelays = toLegacyFormat(PRESET_RELAYS);

export function App() {
  return (
    <UnheadProvider head={head}>
      <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
        <QueryClientProvider client={queryClient}>
          <NostrLoginProvider storageKey='nostr:login'>
            <NostrProvider>
              <EventCachePreloader />
              <KeycastJWTWindowNostr />
              <SentryUserSync />
              <NWCProvider>
                <VideoPlaybackProvider>
                  <FullscreenFeedProvider>
                    <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      <Suspense>
                        <AppRouter />
                      </Suspense>
                    </TooltipProvider>
                  </FullscreenFeedProvider>
                </VideoPlaybackProvider>
              </NWCProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default App;
