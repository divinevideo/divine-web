import { SmartLink } from '@/components/SmartLink';
import { useTranslation } from 'react-i18next';
import { SocialLinks } from '@/components/SocialLinks';
import { HubSpotSignup } from './HubSpotSignup';

export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto border-t border-brand-dark-green py-6 pb-[calc(1.5rem+4rem+env(safe-area-inset-bottom))] md:pb-6 bg-brand-dark-green">
      <div className="container">
        <div className="max-w-5xl mx-auto">
          {/* Main Footer Content - Side by side on desktop */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
            {/* Left side - Email signup */}
            <div className="flex flex-col gap-2 lg:max-w-md">
              <div className="text-sm font-semibold text-brand-green">Divine Inspiration</div>
              <p className="text-sm text-brand-off-white mb-2">
                The Divine beta is currently full. If you'd like to hear our news and be among the first to hear when the Divine app goes live, sign up here.
              </p>
              <HubSpotSignup />
            </div>

            {/* Right side - Navigation Links */}
            <div className="flex flex-col gap-3 text-xs text-white">
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
                <a href="https://about.divine.video/" className="hover:text-brand-off-white transition-colors">
                  About
                </a>
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
                <span>•</span>
                <SmartLink to="/merch" className="hover:text-brand-off-white transition-colors">
                  {t('menu.merch')}
                </SmartLink>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SmartLink to="/support" className="hover:text-brand-off-white transition-colors">
                  Help
                </SmartLink>
                <span>•</span>
                <SmartLink to="/terms" className="hover:text-brand-off-white transition-colors">
                  Terms of Service
                </SmartLink>
                <span>•</span>
                <SmartLink to="/privacy" className="hover:text-brand-off-white transition-colors">
                  Privacy
                </SmartLink>
                <span>•</span>
                <SmartLink to="/safety" className="hover:text-brand-off-white transition-colors">
                  Safety
                </SmartLink>
                <span>•</span>
                <SmartLink to="/dmca" className="hover:text-brand-off-white transition-colors">
                  DMCA & Copyright
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
              <SocialLinks className="mt-1" iconClassName="invert" />
            </div>
          </div>

          {/* Build Info */}
          <div className="text-center text-xs text-white font-light pt-4 border-t border-brand-green">
            Build: {__BUILD_DATE__}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default AppFooter;
