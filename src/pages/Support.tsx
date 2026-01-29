// ABOUTME: Support and contact information page for diVine Web
// ABOUTME: Displays email contact and GitHub issues link for user support

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Github, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingLayout } from '@/components/MarketingLayout';

export function Support() {
  // TEMPORARILY DISABLED (Jan 24, 2026)
  // Widget went live before support team was ready. Re-enable when prepared.
  // To restore: set ZENDESK_ENABLED to true and remove return null in ZendeskWidget.tsx
  const ZENDESK_ENABLED = false;

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

  const openZendeskWidget = () => {
    if (window.zE) {
      window.zE('webWidget', 'open');
    }
  };

  return (
    <MarketingLayout>
      <div className="container max-w-2xl mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Support</h1>
          <p className="text-muted-foreground">
            Need help? We're here to assist you! 
          </p>
        </div>

        {/* Contact Support Card */}
        <Card>
          <CardHeader>
            <CardTitle>diVine Help Center</CardTitle>
            <CardDescription>
              Click below to review our help center or to create a support ticket.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onclick="window.location.href='https://help.divine.video/hc/en-gb/'" size="lg" className="w-full">
              Visit the diVine Help Center
            </Button>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Our Help Center has updated answers to the most common questions. 
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Support
            </CardTitle>
            <CardDescription>
              Our Support team is available to answer your questions. 
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="https://help.divine.video/hc/en-gb/requests/new?ticket_form_id=14332938774671"
              className="text-primary hover:underline font-medium"
            >
              Create a Support Ticket. 
            </a>
          </CardContent>
        </Card>

        <Card>
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

        <Card>
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
