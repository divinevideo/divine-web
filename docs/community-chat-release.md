# Release the production community chat entry

The production app supports real Concord `/invite/<naddr>#<fragment>` links on
any revision containing this change. The default community and Community
chat navigation are enabled when the public build variable `VITE_CONCORD_INVITE_URL`
is nonempty. Dev and PR previews retain the existing POC behavior; previews do
not receive the production default invite from GitHub variables.

For private acceptance, leave the public variable unset. Build or deploy the
reviewed revision normally, then open the unpublished capability invite on
that revision. The invite fragment stays in the browser; do not put it in a
repository file, test log, issue, or PR. This supports testing the exact source
before placing an approved public invite in the default bundle. Missing or
malformed explicit fragments show an error; they never select another community
or the POC. After verification, in-memory selection keeps canonical community
and channel navigation on that invite, even if another default is configured.
Logout or account switching clears it. Reloading without a default requires
opening the original invite again; there is no persistent capability cache.
Opening `/chat` without an invite shows an invite-required state in production.

After private acceptance and approval of the public community:

1. In the repository’s Settings → Secrets and variables → Actions → Variables,
   create or update the repository variable named `VITE_CONCORD_INVITE_URL`.
   Its value is the complete approved **public** Concord invite URL, including
   its fragment. This is public client configuration, not an owner signing key;
   the build includes the value in browser code. Do not use a private invite or
   any signing material as this default.
2. Run the normal production deployment from `main`. A normal main push invokes
   `.github/workflows/deploy.yml`; its existing manual deployment also accepts
   `main`. Merely changing a variable does not rebuild an already deployed app.
   The Build step passes `${{ vars.VITE_CONCORD_INVITE_URL }}` into Vite, and the
   resulting artifact is shared by the existing Fastly and Cloudflare jobs.
3. Verify the deployed revision and its entry bundle using the existing deploy
   checks. On desktop, choose Community chat in the sidebar; on mobile, use
   More options → Community chat. Sign in with the normal account, then verify
   the expected public channels and history. Invalid or unavailable configured
   communities must show failure, never demo channels. Actual cross-client
   send/acknowledgement acceptance uses the agreed test conversation and signer.

No new release flag is required. Room reports keep their existing canonical
endpoint, `https://chat-reports.divine.video/v1/reports`; this change adds no
reports override. Removing the public variable and rebuilding hides the default
entry. It does not revoke capability links; revocation remains a signed
community/invite operation.

Local synthetic verification is `npm run test:production:chat` after installing
the Playwright Chromium browser (`npx playwright install chromium`). An installed
Chrome can be used with `PLAYWRIGHT_CHANNEL=chrome`. The command builds two isolated temporary
production bundles without touching deployment `dist`: one with the checked-in synthetic public invite and one
without a default. Browser tests cover desktop/mobile navigation, signed channel
history, unpublished capability entry, malformed explicit fragments, and forged
bundles. External HTTP is blocked and every WebSocket is served locally from
synthetic signed fixtures. No real relay message or report is published.
