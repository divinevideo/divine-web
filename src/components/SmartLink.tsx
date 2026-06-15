// ABOUTME: Subdomain-aware link component — drop-in replacement for React Router's Link
// ABOUTME: On subdomains, routes links to apex domain unless content belongs to subdomain user

import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { getSubdomainAwareUrl } from '@/lib/subdomainLinks';

interface SmartLinkProps extends Omit<LinkProps, 'to'> {
  to: string;
  /** Pubkey (hex or npub) of the content owner. If it matches the subdomain user, link stays local. */
  ownerPubkey?: string | null;
}

/**
 * A link component that is subdomain-aware.
 *
 * On subdomains like alice.divine.video:
 * - Links to alice's content use React Router (stays on subdomain)
 * - Links to other content use <a href> to the apex domain
 *
 * On the apex domain, behaves identically to React Router's <Link>.
 */
export const SmartLink = React.forwardRef<HTMLAnchorElement, SmartLinkProps>(
  ({ to, ownerPubkey, children, ...props }, ref) => {
    const { href, isExternal } = getSubdomainAwareUrl(to, ownerPubkey);

    if (isExternal) {
      return (
        <a ref={ref} href={href} {...props}>
          {children}
        </a>
      );
    }

    return (
      <Link ref={ref} to={href} {...props}>
        {children}
      </Link>
    );
  },
);

SmartLink.displayName = 'SmartLink';
