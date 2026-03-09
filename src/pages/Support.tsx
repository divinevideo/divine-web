// ABOUTME: Support and contact information page for diVine Web
// ABOUTME: Displays email contact and GitHub issues link for user support

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Github, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingLayout } from '@/components/MarketingLayout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDmCapability } from '@/hooks/useDirectMessages';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { DIVINE_SUPPORT_PUBKEY, getDmConversationPath } from '@/lib/dm';

const ZENDESK_ENABLED = false;

export function Support() {
  // Zendesk widget disabled - linking to Help Center instead.
  // To restore widget: set ZENDESK_ENABLED to true and remove return null in ZendeskWidget.tsx
  const navigate = useSubdomainNavigate();
  const { user } = useCurrentUser();
  const { canUseDirectMessages } = useDmCapability();

  useEffect(() => {
    if (!ZENDESK_ENABLED) return;

    // Load Zendesk widget script if not already loaded
    const existingScript = document.getElementById('ze-snippet');

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'ze-snippet';
      script.src = 'https://static.zdassets.com/ekr/snippet.js?key=52ae352e-c83b-4f62-a06a-6784c80d28b1';
      script.async = true;

      script.onload = () => {
        // Wait for zE to be available, then show and open the widget
        const checkZE = setInterval(() => {
          if (window.zE) {
            clearInterval(checkZE);
            // Always show widget on Support page (even on mobile)
            window.zE('webWidget', 'show');
            // Open the web widget automatically
            window.zE('webWidget', 'open');
          }
        }, 100);
      };

      document.body.appendChild(script);
    } else {
      // Script already loaded, show and open the widget
      if (window.zE) {
        window.zE('webWidget', 'show');
        window.zE('webWidget', 'open');
      }
    }

    // Cleanup: Hide widget on mobile when leaving Support page
    return () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      if (isMobile && window.zE) {
        window.zE('webWidget', 'hide');
      }
    };
  }, []);

  return (
    <MarketingLayout>
      <div className="marketing-page marketing-page--narrow marketing-stack">
        <div className="space-y-6">
          <div className="marketing-hero space-y-4">
            <div className="app-eyebrow mx-auto">Help and contact</div>
            <h1 className="marketing-hero__title">Support</h1>
            <p className="marketing-hero__lede">
              Need help, want to report a bug, or want a direct line to the team? Start here.
            </p>
          </div>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle>Visit diVine Help Center</CardTitle>
              <CardDescription>
                Find answers to your questions about diVine.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="https://help.divine.video/" className="block">
                <Button className="w-full sm:w-auto">
                  Visit Help Center
                </Button>
              </a>
            </CardContent>
          </Card>

          {user && canUseDirectMessages && (
            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Message Support
                </CardTitle>
                <CardDescription>
                  Reach the support inbox directly inside diVine using private NIP-17 messages.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate(getDmConversationPath([DIVINE_SUPPORT_PUBKEY]))} className="w-full sm:w-auto">
                  Open Support Chat
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Support
              </CardTitle>
              <CardDescription>
                Create a ticket and we&apos;ll get back to you as soon as possible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="https://help.divine.video/hc/en-gb/requests/new?ticket_form_id=14332938774671"
                className="text-primary hover:underline font-medium"
              >
                Contact Support
              </a>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                GitHub Issues
              </CardTitle>
              <CardDescription>
                Report bugs, request features, or browse existing issues on our GitHub repositories.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-sm font-medium mb-1">Web App:</div>
                <a
                  href="https://github.com/rabble/divine-web/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  github.com/rabble/divine-web/issues
                </a>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Flutter App (iOS/Android):</div>
                <a
                  href="https://github.com/rabble/nostrvine/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  github.com/rabble/nostrvine/issues
                </a>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Community
              </CardTitle>
              <CardDescription>
                Join our community discussions and connect with other Divine users on Nostr.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Divine is built on Nostr, a decentralized social protocol. Find us on your favorite Nostr client!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MarketingLayout>
  );
}
