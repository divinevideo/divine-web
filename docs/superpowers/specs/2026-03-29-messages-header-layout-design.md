# Messages Header Layout Design

**Date:** 2026-03-29

**Goal:** Redesign the top card on the direct messages page so it feels native to the rest of diVine, removes the awkward support tile treatment, and makes compose/search the clear primary jobs.

## Context

The current `MessagesPage` header uses a large hero-card composition with three competing ideas inside one surface:

- page framing (`Messages`, `Direct messages`, support copy)
- inbox actions (`Message support`, `New message`)
- a separate support tile beside the search field

This creates odd width usage on desktop, duplicated support affordances, and a layout that feels more like a generated dashboard than the nearby `ConversationPage` and other diVine card shells.

## Approved Direction

### Header card

Keep the existing rounded, translucent top card treatment so the page still belongs with the rest of the inbox surfaces. Inside that card:

- keep the eyebrow, title, and one short line of supporting copy
- remove the dedicated support button from the header
- remove the embedded support tile from the header
- keep only one primary action in the header: `New message`
- place the search field in the main action row so it is visually primary

### Layout behavior

- On desktop, the header should read as a compact two-part card:
  - title/copy row
  - search + `New message` row
- On mobile, the action row should stack naturally without custom odd widths or empty visual gutters.
- Avoid bespoke grid ratios or decorative secondary tiles in the header.

### Support treatment

`Divine Support` should remain easy to reach, but it should live outside the top box. It becomes a standard conversation row pinned above the normal conversation list so it uses the same spacing, avatar treatment, and rhythm as the rest of the inbox.

## Data and component impact

- Continue using the existing author metadata loading paths already present on this page.
- Reuse the existing `ConversationRow` styling for the support row rather than introducing a new bespoke support card style.
- Keep the current `openConversation` behavior for both support and normal DMs.

## Testing

- Add a page-level test for the redesigned header and support placement.
- Verify the header no longer renders a support CTA inside the top card.
- Verify the support conversation row is rendered separately from the header.
- Run the targeted test file, then the full project test/build command.
