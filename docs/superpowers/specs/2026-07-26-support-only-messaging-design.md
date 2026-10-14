# Support-only messaging — design

**Status:** Approved for implementation on 2026-07-26.

## Product intent

Divine Web does not expose general direct messaging for now. Its NIP-17
messaging capability is a single private channel between the signed-in user and
Divine Support.

The support recipient remains the pinned `DIVINE_SUPPORT_PUBKEY`, which points
to the Divine Moderation account in `src/lib/dm.ts`. General DM plumbing stays
in place so broader messaging can be enabled later without rebuilding NIP-17
transport.

## User experience

- `/messages` opens the canonical Divine Support conversation directly. It is
  no longer an inbox or compose screen.
- Navigation calls the destination **Message Support**, not **Messages**.
- The support conversation keeps its existing message history, composer,
  delivery states, retry behavior, and encrypted NIP-17 transport.
- Search, “New message,” non-support conversation rows, and general-DM empty
  states are removed from the messaging surface.
- Existing non-support conversations are completely hidden. They do not
  contribute unread badges.
- A deep link to a non-support or group conversation redirects to the Divine
  Support conversation with history replacement.
- Profile “Message” actions are available only on the Divine Support profile.
- “Send via message” actions are removed from video menus. Ordinary sharing
  remains available; videos are not implicitly sent to Support.
- The existing Support page continues to open the same support conversation.

## Access policy

Add one pure, centrally reusable support-only policy. A permitted conversation
has exactly one peer and that peer is `DIVINE_SUPPORT_PUBKEY`. Empty, group, and
all other peer sets are not permitted.

Apply the policy at these boundaries:

1. **Send:** `useDmSend` rejects any recipient set other than the single Support
   pubkey before relay resolution, gift-wrap creation, or publication. A typed
   support-only error produces factual user-facing copy and publishes nothing.
2. **Conversation list and unread count:** only the Support conversation may
   leave `useDmConversations`; `useUnreadDmCount` therefore counts Support only.
3. **Thread data:** `useDmConversation` returns history only for the permitted
   Support conversation so a direct route cannot briefly reveal hidden
   messages.
4. **Route:** `ConversationPage` redirects every non-support or group route to
   the canonical Support route.
5. **Compose affordances:** the reusable compose guard blocks every
   non-support pubkey for every user.

The existing protected-minor checks remain defense in depth. Support-only
authorization runs for everyone; protected-minor recipient verification still
runs after it for the permitted Support recipient.

The client still fetches and decrypts NIP-17 wraps as it does today. The policy
filters visibility after verified parsing and blocks publication before any
outbound event is constructed. No Nostr events are deleted or mutated.

## Routing and compatibility

Keep the existing route shapes:

- `/messages`
- `/messages/:conversationId`

Navigation and the Support page resolve to the canonical conversation ID
derived from `DIVINE_SUPPORT_PUBKEY`. `/messages` is retained as a compatibility
entry point and redirects with replacement. Old non-support links also redirect
with replacement, preventing the browser Back action from bouncing between a
blocked route and Support.

No new route or protocol is introduced.

## Copy and documentation

Reuse existing localized Support copy where possible, including
`support.messageSupportTitle`, so navigation does not require duplicating a new
translation key across locales.

Update English user-facing FAQ text that currently claims Divine offers private
user-to-user DMs and private video sharing. It should state that the current
private messaging channel is for contacting Divine Support. Do not claim that
support messages are unreadable by the support team.

## Testing

Use test-driven development and cover:

- the pure policy accepts exactly the single Support peer and rejects empty,
  non-support, and group peer sets;
- the send mutation rejects a non-support recipient before gift-wrap creation
  or publication and still sends to Support;
- conversation history, conversation lists, and unread counts exclude
  non-support peers;
- `/messages` resolves to Support and blocked conversation routes redirect
  there;
- the profile Message affordance appears only for Support;
- video menus no longer offer “Send via message”;
- desktop/header navigation and sidebar navigation use Message Support and
  retain a Support-only unread badge;
- the Support page still opens the canonical Support thread.

Run focused Vitest files during red/green cycles, then the full `npm run test`
gate. Because visible navigation and menus change, also run the relevant
Playwright visual or browser-level checks available for the affected surfaces.

## Out of scope

- Removing or rewriting the NIP-17 implementation.
- Deleting existing non-support events or local outbox records.
- Server-side relay policy changes.
- Building a support ticket system, assignment workflow, or staff UI.
- Enabling any second official account, group chat, user-to-user DM, or private
  video sharing.
