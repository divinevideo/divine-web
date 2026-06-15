# Footer Social Media Icons Design

**Date:** 2025-11-23
**Status:** Approved
**Author:** Claude & Rabble

## Overview

Add social media icon links to the AppFooter component, allowing users to easily follow diVine on Instagram, Reddit, Discord, Twitter, and Bluesky.

## Requirements

### Platforms
- Instagram: https://instagram.com/divinevideapp
- Reddit: https://www.reddit.com/r/divinevideo/
- Discord: https://discord.gg/RZVbzuQ5qM
- Twitter: https://twitter.com/divinevideoapp
- Bluesky: https://bsky.app/profile/divine.video

### Design Constraints
- Must match existing footer styling and design system
- Should work on mobile and desktop layouts
- Icons should be accessible with proper aria labels
- Must follow existing Tailwind CSS patterns

## Architecture

### Asset Management
**Location:** `/public/social-icons/`

Created 5 SVG icon files using standard brand logos:
- `instagram.svg` - Instagram camera/square logo
- `reddit.svg` - Reddit Snoo alien logo
- `discord.svg` - Discord game controller logo
- `twitter.svg` - X/Twitter logo (current branding)
- `bluesky.svg` - Bluesky butterfly logo

**Format:** All SVGs use `fill="currentColor"` to enable CSS color styling

### Component Structure

**File to modify:** `src/components/AppFooter.tsx`

**Placement:** Icons will be positioned next to navigation links on the right side of the footer, creating this layout structure:

```
Desktop (lg+):
┌─────────────────────────────────────────┐
│ Email Signup │ Featured Links           │
│              │ Navigation Links         │
│              │ Social Icons ←new        │
└─────────────────────────────────────────┘

Mobile:
┌─────────────────┐
│ Email Signup    │
│ Featured Links  │
│ Navigation Links│
│ Social Icons ←new│
└─────────────────┘
```

## Visual Design

### Icon Styling
- **Size:** 20x20px (w-5 h-5 in Tailwind)
- **Base color:** `text-muted-foreground` (matches footer text)
- **Hover state:** `hover:text-foreground` for subtle emphasis
- **Spacing:** `gap-3` between icons (12px)
- **Transition:** `transition-colors` for smooth hover effect

### Accessibility
- Each link includes `aria-label` with platform name (e.g., "Follow us on Instagram")
- Links open in new tab with `target="_blank"`
- Include `rel="noopener noreferrer"` for security

### Container
```jsx
<div className="flex items-center gap-3" aria-label="Social media links">
  {/* Icon links */}
</div>
```

## Implementation Details

### Icon Link Pattern
Each social media link follows this structure:

```jsx
<a
  href="[PLATFORM_URL]"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Follow us on [PLATFORM]"
  className="text-muted-foreground hover:text-foreground transition-colors"
>
  <img
    src="/social-icons/[platform].svg"
    alt="[Platform]"
    className="w-5 h-5"
  />
</a>
```

### Integration with Existing Layout

The social icons section will be added after the existing navigation links section, within the right column of the footer:

```jsx
{/* Right side - Navigation Links */}
<div className="flex flex-col gap-3 text-xs text-muted-foreground">
  {/* Featured Links - existing */}
  {/* Navigation Links - existing */}

  {/* Social Media Icons - new */}
  <div className="flex items-center gap-3 mt-1" aria-label="Social media links">
    {/* Social icons here */}
  </div>
</div>
```

## Testing Checklist

- [ ] All icons load correctly
- [ ] Links open in new tabs
- [ ] Hover states work on desktop
- [ ] Touch targets are adequate on mobile (icons + padding = ~44px minimum)
- [ ] Icons are visible in both light and dark modes
- [ ] Screen readers properly announce the links
- [ ] Layout doesn't break on narrow mobile screens

## Future Considerations

- If more social platforms are added, consider wrapping to multiple rows on mobile
- Consider adding tooltip hover effects showing platform names
- Could add subtle brand color transitions on hover instead of just text-foreground

## Files Modified

1. `/public/social-icons/` - New directory with 5 SVG files
2. `src/components/AppFooter.tsx` - Add social icons section

## Files Created

- `/public/social-icons/instagram.svg`
- `/public/social-icons/reddit.svg`
- `/public/social-icons/discord.svg`
- `/public/social-icons/twitter.svg`
- `/public/social-icons/bluesky.svg`
