// ABOUTME: Zendesk support widget component
// ABOUTME: Loads the Zendesk web widget for customer support

import { useEffect } from 'react';

interface ZendeskWidgetProps {
  hideOnMobile?: boolean;
}

export function ZendeskWidget({ hideOnMobile = true }: ZendeskWidgetProps) {
  // TEMPORARILY DISABLED (Jan 24, 2026)
  // Widget went live before support team was ready. Re-enable when prepared.
  // To restore: remove this return and the early return in Support.tsx useEffect
  return null;

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
        // Apply mobile hiding if needed
        if (hideOnMobile) {
          applyMobileHiding();
        }
      };

      document.body.appendChild(script);
    } else if (hideOnMobile) {
      // Script already loaded, apply mobile hiding immediately
      applyMobileHiding();
    }

    function applyMobileHiding() {
      // Wait for zE to be available
      const checkZE = setInterval(() => {
        if (window.zE) {
          clearInterval(checkZE);

          // Hide on mobile (screens < 768px)
          const isMobile = window.matchMedia('(max-width: 767px)').matches;
          if (isMobile) {
            window.zE('webWidget', 'hide');
          } else {
            window.zE('webWidget', 'show');
          }
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
  }, [hideOnMobile]);

  return null; // This component doesn't render anything visible
}
