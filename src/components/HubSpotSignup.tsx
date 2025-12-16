import { useEffect } from 'react';

// Only load HubSpot on production and localhost
function isHubSpotAllowed(): boolean {
  const hostname = window.location.hostname;
  return hostname === 'divine.video' || hostname === 'about.divine.video' || hostname === 'localhost';
}

export function HubSpotSignup() {
  useEffect(() => {
    // Skip HubSpot on staging/typo domains (devine.video, dvines.org, etc.)
    if (!isHubSpotAllowed()) {
      return;
    }

    // Load HubSpot script
    const script = document.createElement('script');
    script.src = 'https://js-na2.hsforms.net/forms/embed/developer/244466832.js';
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      <style>{`
        /* Base HubSpot v4 form styles - applies to all instances */
        .hs-form-html [data-hsfc-id="Renderer"] {
          --hsf-background__padding: 0;
          --hsf-row__vertical-spacing: 0;
          --hsf-row__horizontal-spacing: 8px;
          --hsf-button__background-color: #00b488;
          --hsf-button__color: white;
          --hsf-button__border-radius: 4px;
          --hsf-button__padding: 0 16px;
          --hsf-button__font-weight: 500;
          --hsf-button__font-size: 0.875rem;
          --hsf-field-input__font-size: 0.875rem;
          --hsf-field-input__background-color: hsl(var(--input));
          --hsf-field-input__color: hsl(var(--foreground));
          --hsf-field-input__border-color: hsl(var(--border));
          --hsf-field-input__border-radius: 4px;
          --hsf-field-input__padding: 0 12px;
          --hsf-field-input__placeholder-color: hsl(var(--muted-foreground));
        }
        .hs-form-html .hsfc-Step {
          border: none !important;
          background: none !important;
        }
        .hs-form-html .hsfc-Step__Content {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          gap: 8px !important;
          align-items: flex-start !important;
          padding: 0 !important;
        }
        .hs-form-html .hsfc-Row:has(.hsfc-RichText) {
          display: none !important;
        }
        .hs-form-html .hsfc-Row:has(.hsfc-EmailField) {
          flex: 1 !important;
          margin-bottom: 0 !important;
          position: relative !important;
        }
        .hs-form-html .hsfc-Row:has(.hsfc-EmailField) .hsfc-FieldError {
          position: absolute !important;
          top: 100% !important;
          left: 0 !important;
          right: 0 !important;
        }
        .hs-form-html .hsfc-NavigationRow {
          flex: 0 0 auto !important;
          margin-top: 0 !important;
        }
        .hs-form-html .hsfc-NavigationRow__Buttons {
          justify-content: flex-start !important;
        }
        .hs-form-html .hsfc-FieldLabel {
          display: none !important;
        }
        .hs-form-html .hsfc-RichText {
          display: none !important;
        }
        .hs-form-html .hsfc-TextInput {
          height: 36px !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .hs-form-html .hsfc-Button {
          height: 36px !important;
          box-sizing: border-box !important;
        }

        /* Landing page card variant - larger with 70/30 split */
        .hs-form-landing .hs-form-html [data-hsfc-id="Renderer"] {
          --hsf-row__horizontal-spacing: 10px;
          --hsf-button__padding: 10px 20px;
          --hsf-button__font-weight: 700;
          --hsf-button__font-size: 14px;
          --hsf-field-input__font-size: 14px;
          --hsf-field-input__padding: 10px 10px;
        }
        .hs-form-landing .hs-form-html .hsfc-Step__Content {
          gap: 10px !important;
        }
        .hs-form-landing .hs-form-html .hsfc-Row:has(.hsfc-EmailField) {
          flex: 7 !important;
        }
        .hs-form-landing .hs-form-html .hsfc-NavigationRow {
          flex: 3 !important;
        }
        .hs-form-landing .hs-form-html .hsfc-TextInput {
          height: 48px !important;
        }
        .hs-form-landing .hs-form-html .hsfc-Button {
          height: 48px !important;
          width: 100% !important;
        }

        @media (max-width: 480px) {
          .hs-form-html .hsfc-Step__Content {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .hs-form-html .hsfc-Button {
            width: 100% !important;
          }
          .hs-form-landing .hs-form-html .hsfc-Row:has(.hsfc-EmailField),
          .hs-form-landing .hs-form-html .hsfc-NavigationRow {
            flex: 1 !important;
          }
        }
      `}</style>
      <div
        className="hs-form-html"
        data-region="na2"
        data-form-id="0da93daf-2cce-45ba-8591-6c68c0b733b0"
        data-portal-id="244466832"
      />
    </>
  );
}
