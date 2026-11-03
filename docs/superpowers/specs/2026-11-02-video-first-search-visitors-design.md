# Video first visits from search

## Intent

People arriving from search should see and play Divine videos immediately, keep browsing, and encounter a small app link only after playback begins. Anonymous browsing should set no cookies. Signing in may still set the cookie needed for cross-subdomain login.

The supplied Search Console report shows 3,097 clicks from 142,650 impressions. Divine and Vine navigation terms account for much of the visible click volume. Queries about a Vine revival, the archive, and the app suggest clear paths from search to watching and then installing. Broad or unrelated queries should not drive new content or targeting.

## Current behavior

- `/` already opens a public discovery feed for signed-out visitors. Fastly renders feed and video HTML with playable content and metadata before React hydrates.
- Both `index.html` and the Fastly shell inject HubSpot tracking at startup. That script owns the consent banner. Marketing page email forms load another HubSpot script when mounted.
- Firebase initialization runs at startup, although its analytics collection waits for HubSpot consent. Product analytics also waits for that consent. Without the HubSpot banner, those collectors have no consent signal and must remain off.
- The mobile install card is timed: it can cover a video ten seconds after a visitor lands on any non-home route. The desktop sidebar already has app store links.
- Cross-subdomain login cookies are set as part of authentication; anonymous video requests do not need them. The shared UI sidebar's persistence cookie is not mounted by the current app.

## Approaches

1. **Recommended and chosen: remove automatic tracking scripts, show an inline app link after playback.** This creates the requested viewing path and keeps anonymous browsing free of cookies. It gives up client-side anonymous conversion attribution until a separate privacy-safe measurement design exists.
2. Delay the consent banner and timed install card. This still interrupts viewing and may set tracking state, so it conflicts with the requested experience.
3. Build a separate search landing site. This adds another route and content system even though Fastly and the SPA already render public videos.

## Design

1. Remove HubSpot tracking injection from both HTML shells. Do not start Firebase analytics without an explicit consent path. Keep product analytics gated off when consent is unknown. Leave login cookie creation behind an intentional sign-in action. Load the HubSpot email form only after an explicit request to open it; the form is outside the video viewing path.
2. Remove the timed mobile install overlay. For a signed-out mobile visitor, show one small inline link to the appropriate app store after the current video begins playback. Place it after the played video in the feed and below the player on a direct video page. It should not obscure playback, require dismissal, or write a persistence key. Keep existing desktop store links and `/download`.
3. Make the homepage's edge and React title and description explain that Divine has classic Vines and new short videos that can be watched on the web. Preserve the feed as the first substantial content. Keep actual content, titles, and canonical URLs aligned; do not create pages to match unrelated or explicit queries.
4. Update the architecture documentation for the startup and Fastly shell changes. Deliver the privacy/viewing change and search copy as focused reviewable commits or pull requests, with checks for both edge and SPA HTML.

## Verification

- A fresh anonymous visit to `/`, `/discovery`, and `/video/:id` shows playable content with no consent banner, no install overlay, and no cookie writes by our code. Check network requests for startup tracking scripts in both Fastly HTML and the SPA fallback.
- A mobile inline app link appears only after playback begins and opens the correct store. Desktop layout and authenticated browsing keep their current navigation.
- Sign-in still sets and restores its required auth cookie. The newsletter form still works after the visitor explicitly opens it.
- Run focused Vitest and edge template tests, type-check, lint, build, and a browser visual check on a mobile viewport. Inspect CI before handoff.

## Limits

Search Console clicks measure acquisition. Without anonymous identifiers or consent, this change cannot attribute a specific search click to an app installation. Any later aggregate measurement needs its own design and privacy review. Existing cookies already stored in returning browsers are not erased by this change.

Fullscreen compilation playback retains its current controls; the inline app link belongs to the public feed and direct video card where it can sit below the video without covering it.
