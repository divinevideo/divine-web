// ABOUTME: Zendesk support widget component
// ABOUTME: Loads the Zendesk web widget for customer support and identifies users

import { useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface ZendeskWidgetProps {
  hideOnMobile?: boolean;
}

export function ZendeskWidget({ hideOnMobile = true }: ZendeskWidgetProps) {
  const { user, displayName } = useCurrentUser();

  useEffect(() => {
    // Check if script already exists
    const existingScript = document.getElementById('ze-snippet');

    if (!existingScript) {
      // Load Zendesk widget script
      const script = document.createElement('script');
      script.id = 'ze-snippet';
      script.src = 'https://static.zdassets.com/ekr/snippet.js?key=52ae352e-c83b-4f62-a06a-6784c80d28b1';
      script.async = true;

      script.onload = () => {
        if (hideOnMobile) {
          applyMobileHiding();
        }
        identifyUser();
      };

      document.body.appendChild(script);
    } else {
      if (hideOnMobile) {
        applyMobileHiding();
      }
      identifyUser();
    }

    function applyMobileHiding() {
      // Wait for zE to be available
      const checkZE = setInterval(() => {
        if (window.zE) {
          clearInterval(checkZE);
          // Hide the chat widget by default - support is accessed via the Support page
          window.zE('webWidget', 'hide');
        }
      }, 100);
    }

    function identifyUser() {
      if (!user?.pubkey) return;
      const checkZE = setInterval(() => {
        if (window.zE) {
          clearInterval(checkZE);
          window.zE('webWidget', 'identify', {
            name: displayName || user.pubkey.slice(0, 8),
            email: `${user.pubkey}@reports.divine.video`,
          });
        }
      }, 100);
    }

    // Cleanup: Ensure widget visibility is set correctly when component unmounts
    return () => {
      if (hideOnMobile) {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        if (isMobile && window.zE) {
          window.zE('webWidget', 'hide');
        }
      }
    };
  }, [hideOnMobile, user?.pubkey, displayName]);

  return null; // This component doesn't render anything visible
}
