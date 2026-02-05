import { SmartLink } from '@/components/SmartLink';
import { HubSpotSignup } from './HubSpotSignup';

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-brand-dark-green py-6 pb-[calc(1.5rem+4rem+env(safe-area-inset-bottom))] md:pb-6 bg-brand-dark-green">
      <div className="container">
        <div className="max-w-5xl mx-auto">
          {/* Main Footer Content - Side by side on desktop */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
            {/* Left side - Email signup */}
            <div className="flex flex-col gap-2 lg:max-w-md">
              <div className="text-sm font-semibold text-brand-green">diVine Inspiration</div>
              <p className="text-sm text-brand-off-white mb-2">
                The diVine beta is currently full. If you'd like to hear our news and be amongst the first to hear when the diVine app goes live, sign up here.
              </p>
              <HubSpotSignup />
            </div>

            {/* Right side - Navigation Links */}
            <div className="flex flex-col gap-3 text-xs text-brand-light-green">
              {/* Featured Links */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <SmartLink
                  to="/human-created"
                  className="font-semibold text-brand-green hover:text-brand-light-green transition-colors"
                >
                  Made with Love
                </SmartLink>
                <span className="text-brand-light-green">•</span>
                <SmartLink
                  to="/proofmode"
                  className="font-semibold text-brand-green hover:text-brand-light-green transition-colors"
                >
                  No AI Slop
                </SmartLink>
              </div>

              {/* Navigation Links */}
              <div className="flex flex-wrap items-center gap-2">
                <SmartLink to="/about" className="hover:text-brand-off-white transition-colors">
                  About
                </SmartLink>
                <span>•</span>
                <a href="https://about.divine.video/faqs/" className="hover:text-brand-off-white transition-colors">
                  FAQ
                </a>
                <span>•</span>
                <SmartLink to="/authenticity" className="hover:text-brand-off-white transition-colors">
                  Our Mission
                </SmartLink>
                <span>•</span>
                <a href="https://about.divine.video/news/" className="hover:text-brand-off-white transition-colors">
                  News
                </a>
                <span>•</span>
                <a href="https://about.divine.video/media-resources/" className="hover:text-brand-off-white transition-colors">
                  Media Resources
                </a>
                <span>•</span>
                <a href="https://about.divine.video/blog/" className="hover:text-brand-off-white transition-colors">
                  Blog
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SmartLink to="/support" className="hover:text-brand-off-white transition-colors">
                  Help
                </SmartLink>
                <span>•</span>
                <SmartLink to="/privacy" className="hover:text-brand-off-white transition-colors">
                  Privacy
                </SmartLink>
                <span>•</span>
                <SmartLink to="/terms" className="hover:text-brand-off-white transition-colors">
                  EULA/T&C
                </SmartLink>
                <span>•</span>
                <SmartLink to="/safety" className="hover:text-brand-off-white transition-colors">
                  Safety
                </SmartLink>
                <span>•</span>
                <SmartLink to="/open-source" className="hover:text-brand-off-white transition-colors">
                  Open Source
                </SmartLink>
                <span>•</span>
                <a
                  href="https://opencollective.com/aos-collective/contribute/divine-keepers-95646"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-off-white transition-colors"
                >
                  Donate
                </a>
              </div>

              {/* Social Media Icons */}
              <div className="flex items-center gap-3 mt-1" aria-label="Social media links">
                <a
                  href="https://www.instagram.com/divinevideoapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Instagram"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <img
                    src="/social-icons/instagram.svg"
                    alt="Instagram"
                    className="w-5 h-5 invert"
                  />
                </a>
                <a
                  href="https://www.reddit.com/r/divinevideo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Reddit"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <img
                    src="/social-icons/reddit.svg"
                    alt="Reddit"
                    className="w-5 h-5 invert"
                  />
                </a>
                <a
                  href="https://discord.gg/2J5JcUKrPw"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join us on Discord"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <img
                    src="/social-icons/discord.svg"
                    alt="Discord"
                    className="w-5 h-5 invert"
                  />
                </a>
                <a
                  href="https://twitter.com/divinevideoapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Twitter"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <img
                    src="/social-icons/twitter.svg"
                    alt="Twitter"
                    className="w-5 h-5 invert"
                  />
                </a>
                <a
                  href="https://bsky.app/profile/divine.video"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Bluesky"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <img
                    src="/social-icons/bluesky.svg"
                    alt="Bluesky"
                    className="w-5 h-5 invert"
                  />
                </a>
                <a
                  href="https://www.tiktok.com/@divine.video"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on TikTok"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <img
                    src="/social-icons/tiktok.svg"
                    alt="TikTok"
                    className="w-5 h-5 invert"
                  />
                </a>
                <a
                  href="https://github.com/divinevideo"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on GitHub"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <img
                    src="/social-icons/github.svg"
                    alt="GitHub"
                    className="w-5 h-5 invert"
                  />
                </a>
                <a
                  href="https://www.youtube.com/channel/UCkAaxItWqDpTgngWAS2cAtQ"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on YouTube"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <img
                    src="/social-icons/youtube.svg"
                    alt="YouTube"
                    className="w-5 h-5 invert"
                  />
                </a>
              </div>
            </div>
          </div>

          {/* Build Info */}
          <div className="text-center text-xs text-brand-light-green font-light pt-4 border-t border-brand-green">
            Build: {__BUILD_DATE__}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default AppFooter;
