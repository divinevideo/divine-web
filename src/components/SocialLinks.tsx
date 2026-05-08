// ABOUTME: Renders the standard divine social-media icon row (Instagram, Reddit,
// ABOUTME: Discord, Twitter, Bluesky, TikTok, GitHub, YouTube). Single source of truth
// ABOUTME: so the sidebar and footer never drift apart.

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface SocialLink {
  name: string;
  href: string;
  icon: string;
  ariaLabelKey: string;
}

const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/divinevideoapp',
    icon: '/social-icons/instagram.svg',
    ariaLabelKey: 'socialLinks.followInstagram',
  },
  {
    name: 'Reddit',
    href: 'https://www.reddit.com/r/divinevideo/',
    icon: '/social-icons/reddit.svg',
    ariaLabelKey: 'socialLinks.followReddit',
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/d6HpB6XnHp',
    icon: '/social-icons/discord.svg',
    ariaLabelKey: 'socialLinks.joinDiscord',
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com/divinevideoapp',
    icon: '/social-icons/twitter.svg',
    ariaLabelKey: 'socialLinks.followTwitter',
  },
  {
    name: 'Bluesky',
    href: 'https://bsky.app/profile/divine.video',
    icon: '/social-icons/bluesky.svg',
    ariaLabelKey: 'socialLinks.followBluesky',
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@divine.video',
    icon: '/social-icons/tiktok.svg',
    ariaLabelKey: 'socialLinks.followTiktok',
  },
  {
    name: 'GitHub',
    href: 'https://github.com/divinevideo',
    icon: '/social-icons/github.svg',
    ariaLabelKey: 'socialLinks.followGithub',
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/channel/UCkAaxItWqDpTgngWAS2cAtQ',
    icon: '/social-icons/youtube.svg',
    ariaLabelKey: 'socialLinks.followYoutube',
  },
] as const;

interface SocialLinksProps {
  className?: string;
  /** Tailwind class applied to each <img>. Use `invert` on dark surfaces, `dark:invert` for surfaces that switch. */
  iconClassName?: string;
  /** Tailwind size class for each icon. Defaults to w-5 h-5. */
  size?: string;
}

export function SocialLinks({ className, iconClassName, size = 'w-5 h-5' }: SocialLinksProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn('flex items-center gap-3', className)}
      aria-label={t('socialLinks.groupLabel')}
    >
      {SOCIAL_LINKS.map((link) => (
        <a
          key={link.name}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t(link.ariaLabelKey)}
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          <img src={link.icon} alt={link.name} className={cn(size, iconClassName)} />
        </a>
      ))}
    </div>
  );
}

export default SocialLinks;
