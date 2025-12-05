// ABOUTME: MailerLite email signup form component
// ABOUTME: Embedded form for mailing list signups on the landing page

import { useEffect } from 'react';

export function MailerLiteSignup() {
  useEffect(() => {
    // Load MailerLite scripts
    const script1 = document.createElement('script');
    script1.src = 'https://groot.mailerlite.com/js/w/webforms.min.js?v176e10baa5e7ed80d35ae235be3d5024';
    script1.type = 'text/javascript';
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.text = 'fetch("https://assets.mailerlite.com/jsonp/922604/forms/171053339050510058/takel")';
    document.body.appendChild(script2);

    return () => {
      // Cleanup scripts on unmount
      if (document.body.contains(script1)) {
        document.body.removeChild(script1);
      }
      if (document.body.contains(script2)) {
        document.body.removeChild(script2);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get('fields[email]') as string;

    if (!email) return;

    // Submit via fetch to avoid page redirect
    fetch(form.action, {
      method: 'POST',
      body: formData,
      mode: 'no-cors', // MailerLite doesn't support CORS, but we don't need the response
    }).then(() => {
      // Show success message
      const successBody = document.querySelector('.ml-subscribe-form-33354076 .row-success') as HTMLElement;
      const formBody = document.querySelector('.ml-subscribe-form-33354076 .row-form') as HTMLElement;

      if (successBody && formBody) {
        successBody.style.display = 'block';
        formBody.style.display = 'none';
      }
    }).catch((error) => {
      console.error('Error submitting form:', error);
      // Still show success since we can't read the response anyway with no-cors
      const successBody = document.querySelector('.ml-subscribe-form-33354076 .row-success') as HTMLElement;
      const formBody = document.querySelector('.ml-subscribe-form-33354076 .row-form') as HTMLElement;

      if (successBody && formBody) {
        successBody.style.display = 'block';
        formBody.style.display = 'none';
      }
    });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url("https://assets.mlcdn.com/fonts.css?version=1762785");

        /* LOADER */
        .ml-form-embedSubmitLoad {
          display: inline-block;
          width: 20px;
          height: 20px;
        }

        .g-recaptcha {
          transform: scale(1);
          -webkit-transform: scale(1);
          transform-origin: 0 0;
          -webkit-transform-origin: 0 0;
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

        #mlb2-33354076.ml-form-embedContainer {
          box-sizing: border-box;
          display: table;
          margin: 0 auto;
          position: static;
          width: 100% !important;
        }

        #mlb2-33354076.ml-form-embedContainer h4,
        #mlb2-33354076.ml-form-embedContainer p,
        #mlb2-33354076.ml-form-embedContainer span,
        #mlb2-33354076.ml-form-embedContainer button {
          text-transform: none !important;
          letter-spacing: normal !important;
        }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper {
          background-color: hsl(var(--card));
          border-width: 1px;
          border-color: hsl(var(--border));
          border-radius: 8px;
          border-style: solid;
          box-sizing: border-box;
          display: inline-block !important;
          margin: 0;
          padding: 0;
          position: relative;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
        }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper.embedPopup,
        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper.embedDefault { width: 400px; }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper.embedForm { max-width: 600px; width: 100%; }

        #mlb2-33354076.ml-form-embedContainer .ml-form-align-center { text-align: center; }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody,
        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper .ml-form-successBody {
          padding: 24px 24px 24px 24px;
        }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody.ml-form-embedBodyHorizontal {
          padding-bottom: 24px;
        }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody .ml-form-embedContent h4 {
          color: hsl(var(--foreground));
          font-family: 'Inter Variable', 'Open Sans', Arial, Helvetica, sans-serif;
          font-size: 16px;
          font-weight: 400;
          margin: 0 0 8px 0;
          text-align: center;
          word-break: break-word;
        }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody .ml-form-embedContent p {
          color: hsl(var(--foreground));
          font-family: 'Inter Variable', 'Open Sans', Arial, Helvetica, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 20px;
          margin: 0 0 24px 0;
          text-align: center;
        }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody .ml-form-horizontalRow input {
          background-color: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
          border-color: hsl(var(--border));
          border-radius: 4px;
          border-style: solid;
          border-width: 1px;
          font-family: 'Inter Variable', 'Open Sans', Arial, Helvetica, sans-serif;
          font-size: 14px;
          line-height: 20px;
          margin-bottom: 0;
          margin-top: 0;
          padding: 10px 10px;
          width: 100%;
          box-sizing: border-box;
        }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody .ml-form-horizontalRow button {
          background-color: #00B488 !important;
          border-color: #00B488;
          border-style: solid;
          border-width: 1px;
          border-radius: 4px;
          box-shadow: none;
          color: #ffffff !important;
          cursor: pointer;
          font-family: 'Inter Variable', 'Open Sans', Arial, Helvetica, sans-serif;
          font-size: 14px !important;
          font-weight: 700;
          line-height: 20px;
          margin: 0 !important;
          padding: 10px !important;
          width: 100%;
          height: auto;
        }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody .ml-form-horizontalRow button:hover {
          background-color: #009d76 !important;
          border-color: #009d76 !important;
        }

        .ml-form-formContent.horozintalForm .ml-form-horizontalRow .ml-input-horizontal { width: 70%; float: left; }
        .ml-form-formContent.horozintalForm .ml-form-horizontalRow .ml-button-horizontal { width: 30%; float: left; }
        .ml-form-formContent.horozintalForm .ml-form-horizontalRow .horizontal-fields { box-sizing: border-box; float: left; padding-right: 10px; }

        #mlb2-33354076.ml-form-embedContainer .ml-form-embedWrapper .ml-form-embedBody .ml-form-formContent.horozintalForm {
          padding: 0 0 0 0;
          margin-bottom: 0;
        }

        .ml-form-successBody { display: none; }

        @media only screen and (max-width: 400px) {
          .ml-form-embedWrapper.embedDefault, .ml-form-embedWrapper.embedPopup { width: 100%!important; }
          .ml-form-formContent.horozintalForm { float: left!important; }
          .ml-form-formContent.horozintalForm .ml-form-horizontalRow { height: auto!important; width: 100%!important; float: left!important; }
          .ml-form-formContent.horozintalForm .ml-form-horizontalRow .ml-input-horizontal { width: 100%!important; }
          .ml-form-formContent.horozintalForm .ml-form-horizontalRow .ml-input-horizontal > div { padding-right: 0px!important; padding-bottom: 10px; }
          .ml-form-formContent.horozintalForm .ml-button-horizontal { width: 100%!important; }
          .ml-form-formContent.horozintalForm .ml-form-horizontalRow .horizontal-fields { margin-bottom: 10px !important; width: 100% !important; }
        }
      `}} />

      <div id="mlb2-33354076" className="ml-form-embedContainer ml-subscribe-form ml-subscribe-form-33354076">
        <div className="ml-form-align-center">
          <div className="ml-form-embedWrapper embedForm">
            <div className="ml-form-embedBody ml-form-embedBodyHorizontal row-form">
              <div className="ml-form-embedContent">
                <h4>Join the diVine mobile app waitlist</h4>
                <p>Our beta test is full and we can't let more folks on the apps until Apple and Google do their thing. If you want to be the first to know when that happens, join our mailing list.</p>
              </div>

              <form
                className="ml-block-form"
                action="https://assets.mailerlite.com/jsonp/922604/forms/171053339050510058/subscribe"
                data-code=""
                method="post"
                onSubmit={handleSubmit}
              >
                <div className="ml-form-formContent horozintalForm">
                  <div className="ml-form-horizontalRow">
                    <div className="ml-input-horizontal">
                      <div style={{ width: '100%' }} className="horizontal-fields">
                        <div className="ml-field-group ml-field-email ml-validate-email ml-validate-required">
                          <input
                            type="email"
                            className="form-control"
                            name="fields[email]"
                            placeholder="Email"
                            autoComplete="email"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="ml-button-horizontal primary">
                      <button type="submit" className="primary">Sign Me Up</button>
                      <button disabled style={{ display: 'none' }} type="button" className="loading">
                        <div className="ml-form-embedSubmitLoad"></div>
                        <span className="sr-only">Loading...</span>
                      </button>
                    </div>
                  </div>
                </div>

                <input type="hidden" name="ml-submit" value="1" />
                <input type="hidden" name="anticsrf" value="true" />
              </form>
              <br></br><br></br>
            </div>

            <div className="ml-form-successBody row-success" style={{ display: 'none' }}>
              <div className="ml-form-successContent">
                <div className="flex flex-col items-center gap-4">
                  <h4 className="text-2xl font-bold font-pacifico">diVine!</h4>
                  <img
                    src="/divine_mic.avif"
                    alt="diVine microphone"
                    className="w-full max-w-xs object-contain"
                  />
                  <p className="text-center">We'll reach out as soon as we're able to invite you to join us.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
