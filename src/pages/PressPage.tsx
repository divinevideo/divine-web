import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingLayout } from '@/components/MarketingLayout';

export function PressPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Load tracking script
    const trackingScript = document.createElement('script');
    trackingScript.innerHTML = 'fetch("https://assets.mailerlite.com/jsonp/922604/forms/171273553854858427/takel")';
    document.body.appendChild(trackingScript);

    // Create hidden iframe for form submission
    const iframe = document.createElement('iframe');
    iframe.name = 'ml-form-submit-frame';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    return () => {
      if (document.body.contains(trackingScript)) {
        document.body.removeChild(trackingScript);
      }
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;

    // Validate required fields
    const email = (form.elements.namedItem('fields[email]') as HTMLInputElement)?.value;
    const message = (form.elements.namedItem('fields[message]') as HTMLTextAreaElement)?.value;

    if (!email || !message) {
      return;
    }

    setIsSubmitting(true);

    // Submit the form to the iframe (bypasses preventDefault)
    const submitForm = form.cloneNode(true) as HTMLFormElement;
    submitForm.style.display = 'none';
    submitForm.target = 'ml-form-submit-frame';
    document.body.appendChild(submitForm);
    submitForm.submit();
    document.body.removeChild(submitForm);

    // Show success message after a short delay
    setTimeout(() => {
      setIsSuccess(true);
      setIsSubmitting(false);
    }, 800);
  };

  return (
    <MarketingLayout>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url("https://assets.mlcdn.com/fonts.css?version=1762785");

        /* LOADER */
        .ml-form-embedSubmitLoad {
          display: inline-block;
          width: 20px;
          height: 20px;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          border: 0;
        }

        .ml-form-embedSubmitLoad:after {
          content: " ";
          display: block;
          width: 11px;
          height: 11px;
          margin: 1px;
          border-radius: 50%;
          border: 4px solid #fff;
          border-color: #ffffff #ffffff #ffffff transparent;
          animation: ml-form-embedSubmitLoad 1.2s linear infinite;
        }

        @keyframes ml-form-embedSubmitLoad {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        #mlb2-33427086.ml-form-embedContainer {
          box-sizing: border-box;
          display: table;
          margin: 0 auto;
          position: static;
          width: 100% !important;
        }

        #mlb2-33427086.ml-form-embedContainer h4,
        #mlb2-33427086.ml-form-embedContainer p,
        #mlb2-33427086.ml-form-embedContainer span,
        #mlb2-33427086.ml-form-embedContainer button {
          text-transform: none !important;
          letter-spacing: normal !important;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedWrapper {
          background-color: transparent;
          border: none;
          box-sizing: border-box;
          display: inline-block !important;
          margin: 0;
          padding: 0;
          position: relative;
          width: 100%;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedWrapper.embedForm {
          max-width: 600px;
          width: 100%;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-align-center {
          text-align: center;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody {
          padding: 0;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody .ml-form-embedContent h4 {
          color: hsl(var(--foreground));
          font-family: 'Inter Variable', 'Open Sans', Arial, Helvetica, sans-serif;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 12px 0;
          text-align: left;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody .ml-form-embedContent p {
          color: hsl(var(--muted-foreground));
          font-family: 'Inter Variable', 'Open Sans', Arial, Helvetica, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 20px;
          margin: 0 0 24px 0;
          text-align: left;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-formContent .ml-form-fieldRow {
          margin-bottom: 16px;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-formContent .ml-form-fieldRow.ml-last-item {
          margin-bottom: 24px;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedBody input[type="email"],
        #mlb2-33427086.ml-form-embedContainer .ml-form-embedBody input[type="text"],
        #mlb2-33427086.ml-form-embedContainer .ml-form-embedBody textarea {
          background-color: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
          border-color: hsl(var(--input));
          border-radius: 6px;
          border-style: solid;
          border-width: 1px;
          font-family: 'Inter Variable', 'Open Sans', Arial, Helvetica, sans-serif;
          font-size: 14px;
          line-height: 20px;
          padding: 10px 12px;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedBody input[type="email"]:focus,
        #mlb2-33427086.ml-form-embedContainer .ml-form-embedBody input[type="text"]:focus,
        #mlb2-33427086.ml-form-embedContainer .ml-form-embedBody textarea:focus {
          outline: none;
          border-color: hsl(var(--ring));
          box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedBody textarea {
          min-height: 120px;
          resize: vertical;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedSubmit button.primary {
          background-color: hsl(var(--primary)) !important;
          border-color: hsl(var(--primary));
          border-style: solid;
          border-width: 1px;
          border-radius: 6px;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          color: hsl(var(--primary-foreground)) !important;
          cursor: pointer;
          font-family: 'Inter Variable', 'Open Sans', Arial, Helvetica, sans-serif;
          font-size: 14px !important;
          font-weight: 600;
          line-height: 20px;
          margin: 0 !important;
          padding: 10px 16px !important;
          transition: all 0.2s ease;
          height: auto;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedSubmit button.primary:hover:not(:disabled) {
          background-color: hsl(var(--primary) / 0.9) !important;
          box-shadow: 0 2px 4px 0 rgb(0 0 0 / 0.1);
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedSubmit button.primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        #mlb2-33427086.ml-form-embedContainer .ml-form-embedSubmit button.loading {
          display: inline-block;
          margin-left: 8px;
        }
      `}} />
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Press Inquiries</h1>
          <p className="text-lg text-muted-foreground">
            We welcome press and media inquiries about diVine. Please fill out the form below and we'll get back to you as soon as possible.
          </p>
        </div>

        <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Contact Form</CardTitle>
          <CardDescription>
            Please provide your contact information and details about your inquiry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSuccess ? (
            <div id="mlb2-33427086" className="ml-form-embedContainer ml-subscribe-form ml-subscribe-form-33427086">
              <div className="ml-form-align-center">
                <div className="ml-form-embedWrapper embedForm">
                  <div className="ml-form-embedBody ml-form-embedBodyDefault row-form">
                    <div className="ml-form-embedContent">
                      <h4>Media Contact</h4>
                      <p>Share your contact information and deadline below.</p>
                    </div>

                    <form
                      className="ml-block-form"
                      action="https://assets.mailerlite.com/jsonp/922604/forms/171273553854858427/subscribe"
                      data-code=""
                      method="post"
                      target="ml-form-submit-frame"
                      onSubmit={handleSubmit}
                    >
                      <div className="ml-form-formContent">
                        <div className="ml-form-fieldRow">
                          <div className="ml-field-group ml-field-email ml-validate-email ml-validate-required">
                            <input
                              aria-label="email"
                              aria-required="true"
                              type="email"
                              className="form-control"
                              data-inputmask=""
                              name="fields[email]"
                              placeholder="Email"
                              autoComplete="email"
                              required
                            />
                          </div>
                        </div>

                        <div className="ml-form-fieldRow">
                          <div className="ml-field-group ml-field-name">
                            <input
                              aria-label="name"
                              type="text"
                              className="form-control"
                              data-inputmask=""
                              name="fields[name]"
                              placeholder="Name"
                              autoComplete="given-name"
                            />
                          </div>
                        </div>

                        <div className="ml-form-fieldRow">
                          <div className="ml-field-group ml-field-last_name">
                            <input
                              aria-label="last_name"
                              type="text"
                              className="form-control"
                              data-inputmask=""
                              name="fields[last_name]"
                              placeholder="Last name"
                              autoComplete="family-name"
                            />
                          </div>
                        </div>

                        <div className="ml-form-fieldRow ml-last-item">
                          <div className="ml-field-group ml-field-message ml-validate-required">
                            <textarea
                              className="form-control"
                              name="fields[message]"
                              aria-label="message"
                              aria-required="true"
                              maxLength={255}
                              placeholder="Share your deadline and request."
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <input type="hidden" name="ml-submit" value="1" />
                      <input type="hidden" name="anticsrf" value="true" />

                      <div className="ml-form-embedSubmit">
                        <button type="submit" className="primary" disabled={isSubmitting}>
                          {isSubmitting ? 'Submitting...' : 'Subscribe'}
                        </button>
                        {isSubmitting && (
                          <button disabled style={{ display: 'inline-block' }} type="button" className="loading">
                            <div className="ml-form-embedSubmitLoad"></div>
                            <span className="sr-only">Loading...</span>
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="ml-form-successBody row-success">
              <div className="ml-form-successContent text-center py-8">
                <h4 className="text-2xl font-bold mb-4">We've received your inquiry.</h4>
                <p className="text-muted-foreground">Someone from our media team will be in touch shortly.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 p-6 bg-muted/50 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Media Resources</h2>
        <p className="text-muted-foreground mb-4">
          For general information about diVine, please visit our{' '}
          <a href="/about" className="text-primary hover:underline">
            About page
          </a>
          {' '}and{' '}
          <a href="/media-resources" className="text-primary hover:underline">
            Media Resources
          </a>
          .
        </p>
        <p className="text-muted-foreground mb-4">
          Looking for our press releases?{' '}
          <a
            href="/diVine%20launch%20press%20release%2011.13.25.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Read our launch announcement
          </a>
          .
        </p>
        <p className="text-muted-foreground mb-4">
          See where we've been featured:{' '}
          <a href="/news" className="text-primary hover:underline">
            In the News
          </a>
          .
        </p>
        <p className="text-sm text-muted-foreground/70">
          You can also reach us directly at{' '}
          <a
            href="mailto:press@divine.video"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            press@divine.video
          </a>
        </p>
      </div>
      </div>
    </MarketingLayout>
  );
}

export default PressPage;
