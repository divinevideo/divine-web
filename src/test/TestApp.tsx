import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { BrowserRouter } from 'react-router-dom';
import { NostrLoginProvider } from '@nostrify/react/login';
import NostrProvider from '@/components/NostrProvider';
import { AppProvider } from '@/components/AppProvider';
import { NWCProvider } from '@/contexts/NWCContext';
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext';
import { AppConfig } from '@/contexts/AppContext';
import { PRIMARY_RELAY } from '@/config/relays';

interface TestAppProps {
  children: React.ReactNode;
}

export function TestApp({ children }: TestAppProps) {
  const head = createHead();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const defaultConfig: AppConfig = {
    theme: 'light',
    autoScroll: false,
    relayUrl: PRIMARY_RELAY.url,
  };

  return (
    <UnheadProvider head={head}>
      <AppProvider storageKey='test-app-config' defaultConfig={defaultConfig}>
        <QueryClientProvider client={queryClient}>
          <NostrLoginProvider storageKey='test-login'>
            <NostrProvider>
              <NWCProvider>
                <VideoPlaybackProvider>
                  <BrowserRouter>
                    {children}
                  </BrowserRouter>
                </VideoPlaybackProvider>
              </NWCProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default TestApp;