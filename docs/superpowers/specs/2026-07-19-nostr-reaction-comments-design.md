# Nostr-Native Reaction Comments

**Date:** 2026-07-19  
**Status:** Approved protocol direction; pending design review  
**Scope:** Search, select, upload, publish, render, and count reusable animated
reaction media in video comment threads.

## Problem

People should be able to respond to a video with a reusable animated reaction
without depending on a centralized GIF catalog. The reaction needs a stable
Nostr identity so Divine and other clients can find every comment—and therefore
every root video—that uses it.

## User Cases

1. **A signed-in viewer wants to search for a reaction so that they can respond
   without leaving the comment composer.** When they search, the picker returns
   matching, moderated NIP-94 media events and supports keyboard and touch
   selection.
2. **A signed-in viewer wants to choose a reaction so that their response is
   published as an interoperable NIP-22 comment.** When they choose one, the
   comment cites the canonical NIP-94 event and carries enough NIP-92 metadata
   to render without an additional metadata fetch.
3. **A signed-in viewer wants to upload a new reaction so that they can use
   media not already in the catalog.** When upload completes, the client
   publishes a NIP-94 event, uses it immediately in the comment, and makes it
   available in the uploader's personal library.
4. **A viewer wants to see an animated reaction inline so that the conversation
   remains understandable.** When the media is available, the client shows a
   muted looping preview with accessible alternative text and a reduced-motion
   fallback.
5. **A creator or viewer wants to inspect where a reaction is used so that they
   can discover the videos participating in the conversation.** When usage is
   requested, the client queries comments by the reaction event ID and resolves
   each comment's NIP-22 root video reference.

## Goals

- Use existing Nostr and Blossom standards; introduce no Divine-only event
  kind.
- Give every reusable reaction a stable `kind:1063` event identity.
- Make every use queryable through the standard indexed `q` tag.
- Let uploaders use new reactions immediately.
- Preserve media ownership, relay portability, and blob integrity.
- Support GIF, animated WebP, and short muted MP4 media while presenting one
  "reaction" concept in the UI.

## Non-Goals

- Building a centralized licensed-media catalog.
- Treating reactions as NIP-25 likes or votes.
- Extending NIP-30 to `kind:1111`.
- Automatically placing reaction uploads into the main short-video feed.
- Guaranteeing deletion from relays or third-party Blossom servers.

## Standards

| Concern | Standard | Use |
| --- | --- | --- |
| Comment thread | NIP-22 | `kind:1111`, uppercase root tags, lowercase parent tags |
| Inline media | NIP-92 | Media URL in content plus matching `imeta` |
| Reaction identity | NIP-94 | `kind:1063` file metadata event |
| Reaction citation | NIP-22 / NIP-18 | `q` tag referencing the `kind:1063` event |
| Search | NIP-50 | Search `kind:1063` descriptions and indexed tags |
| Usage count | NIP-45 | Count `kind:1111` events filtered by `#q` |
| Media storage | Blossom | Content-addressed upload and retrieval |
| User media host | Blossom BUD-03 / NIP-B7 | `kind:10063` preferred server list |
| Personal packs | NIP-51 | `kind:10030` preferences and `kind:30030` sets |

NIP-30 does not currently specify custom emoji rendering for `kind:1111`.
Emoji lists may organize the picker, but a reaction comment uses NIP-92 media
and a NIP-94 citation.

## Chosen Architecture

### Canonical reaction

A reusable reaction is a signed NIP-94 `kind:1063` event. Its event ID is the
reaction's canonical social identity. Its `x` tag identifies the underlying
blob content.

```json
{
  "kind": 1063,
  "content": "Side-eye reaction",
  "tags": [
    ["url", "https://blossom.example/<sha256>.mp4"],
    ["m", "video/mp4"],
    ["x", "<sha256>"],
    ["size", "183240"],
    ["dim", "480x480"],
    ["duration", "2.4"],
    ["thumb", "https://blossom.example/<thumb-sha256>.webp"],
    ["alt", "A person giving a skeptical side-eye"],
    ["t", "side-eye"],
    ["t", "skeptical"]
  ]
}
```

The client computes the SHA-256 before upload. Search results may group
duplicate `kind:1063` events by `x`, but citations remain event-specific. When
the picker selects a result, the selected event ID is the canonical ID used by
the comment.

### Reaction comment

The comment is a standard `kind:1111` event. It retains all NIP-22 root and
parent tags, cites the selected `kind:1063` event with `q`, and copies the
rendering metadata into `imeta`.

```json
{
  "kind": 1111,
  "content": "https://blossom.example/<sha256>.mp4 nostr:nevent1...",
  "tags": [
    ["E", "<root-video-event-id>", "<relay-hint>", "<root-author>"],
    ["A", "34236:<root-author>:<d-tag>", "<relay-hint>"],
    ["K", "34236"],
    ["P", "<root-author>", "<relay-hint>"],
    ["e", "<parent-event-id>", "<relay-hint>", "<parent-author>"],
    ["k", "<parent-kind>"],
    ["p", "<parent-author>", "<relay-hint>"],
    ["q", "<reaction-1063-event-id>", "<relay-hint>", "<reaction-author>"],
    [
      "imeta",
      "url https://blossom.example/<sha256>.mp4",
      "m video/mp4",
      "x <sha256>",
      "dim 480x480",
      "alt A person giving a skeptical side-eye"
    ]
  ]
}
```

For a top-level comment, the lowercase parent references the root video. For a
reply, it references the immediate `kind:1111` parent. The reaction event must
never be placed in `e`, `E`, `a`, `A`, `k`, or `K`; those tags belong to the
NIP-22 thread structure.

The `nostr:nevent` citation in `content` corresponds to the `q` tag. Clients
with rich reaction support may hide the raw URL and citation while rendering
the attachment. Plain clients still expose portable media and event links.

### Usage discovery

All comments using an exact reaction are fetched with:

```json
{
  "kinds": [1111],
  "#q": ["<reaction-1063-event-id>"]
}
```

The root videos are the unique uppercase `A` addresses, falling back to
uppercase `E` event IDs for non-addressable roots. A NIP-45 count request with
the same filter gives the exact-event usage count.

If a product surface intentionally wants blob-level rather than event-level
usage, it first finds all `kind:1063` events sharing the same `x`, then queries
comments for the resulting set of `q` IDs. Exact-event usage remains the
default because it preserves authorship and catalog identity.

## User Flows

### Search and choose

1. The viewer opens the reaction picker from the comment composer.
2. The picker shows recent personal reactions and moderated trending results.
3. Search sends a debounced NIP-50 query restricted to `kind:1063`.
4. The client accepts supported animated MIME types and validates required
   NIP-94 tags.
5. Selecting a result adds the reaction preview to the composer.
6. Submission publishes one `kind:1111` event with NIP-22, `q`, and `imeta`
   tags.

### Upload and use

1. The viewer chooses a local animated image or short video.
2. The client validates type, dimensions, duration, and size before upload.
3. The client computes SHA-256 and checks for an existing trusted NIP-94 event
   with the same `x`.
4. If no reusable event is selected, the client uploads to the first compatible
   server in the user's `kind:10063` list, with Divine Blossom as fallback.
5. The client publishes a signed `kind:1063` event with a human description,
   alternative text, and search tags.
6. The new reaction is immediately available to the uploader and attached to
   the pending comment.
7. Public discovery includes it only after normal moderation and indexing.

### Render

1. The client validates that the `imeta` URL appears in `content`.
2. It verifies supported HTTPS schemes and uses `m`, `x`, dimensions, and
   thumbnail metadata.
3. Reactions render muted and looped, with playback paused when off-screen.
4. Reduced-motion users see the thumbnail or first frame until they opt in.
5. Load failure falls back to alternative text and a safe external link.

## Moderation and Security

- Only signed `kind:1063` and `kind:1111` events are accepted.
- Upload limits apply before transferring data: supported MIME allowlist,
  maximum bytes, maximum pixel area, and maximum duration.
- Servers verify declared MIME type, file signature, SHA-256, and any generated
  derivatives.
- Clients never render arbitrary HTML from event content or metadata.
- Media URLs must use HTTPS; redirects and proxying follow existing SSRF
  protections.
- Public search excludes blocked, restricted, age-restricted, spam, and
  unreviewed uploads according to Divine's existing moderation policy.
- Muted authors and reported reactions remain hidden under existing Nostr mute
  and report behavior.
- The uploader can request deletion from Blossom and relays, but the UI does
  not promise global deletion.

## Failure Behavior

- **Search unavailable:** show personal/recent reactions and allow upload.
- **Preferred Blossom unavailable:** try the next declared server, then the
  Divine fallback.
- **Existing blob but missing metadata event:** publish a new signed
  `kind:1063` event after validating the blob descriptor.
- **Metadata publish fails after upload:** do not publish the comment; preserve
  the local draft and retry metadata publication.
- **Comment publish fails:** preserve the chosen reaction and comment draft for
  retry.
- **Reaction event unavailable while rendering:** render from valid NIP-92
  metadata already carried by the comment.
- **Media unavailable:** show alt text and the Nostr citation rather than an
  empty card.

## Alternatives Considered

### Use `kind:34236` reactions

This aligns with Divine's existing recorded video replies, but it mixes
reusable catalog assets with feed videos and makes image/GIF reactions awkward.
It remains appropriate for original recorded video replies, not the reusable
reaction library.

### Use only NIP-30 emoji tags and `kind:30030` sets

This provides useful personal packs, but NIP-30 does not define `kind:1111`
rendering and does not provide the same file metadata or usage citation model.
It is an optional organization layer, not the comment encoding.

### Introduce a custom reaction event kind or tag

This could encode Divine-specific semantics directly, but would reduce
interoperability and duplicate the combination of NIP-94, NIP-92, NIP-22, and
`q`. It is rejected.

## Test Strategy

### Protocol unit tests

- Build top-level and nested reaction comments with correct NIP-22 tags.
- Assert exactly one `q` tag references the selected `kind:1063` event.
- Assert no thread tag is repurposed for the reaction.
- Assert the NIP-92 URL appears in content and matches `imeta`.
- Parse supported GIF, WebP, and MP4 metadata.
- Reject unsupported schemes, MIME mismatches, invalid hashes, and oversized
  files.

### Query tests

- Query `kind:1111` by `#q` and resolve unique root `A`/`E` references.
- Count exact-event usage with the same filter.
- Group catalog duplicates by NIP-94 `x` without changing stored citations.
- Verify addressable video roots are deduplicated by address, not event ID.

### UI tests

- Search, empty, loading, offline, and error states.
- Select existing reaction and upload a new reaction.
- Keyboard navigation, focus management, alt text, and reduced motion.
- Inline rendering, off-screen pause, broken-media fallback, and retry.
- Draft preservation when metadata or comment publication fails.

### Integration tests

- Blossom upload to signed NIP-94 publication to NIP-22 comment publication.
- A second client discovers the reaction comment from relay data alone.
- Usage lookup returns all root videos citing the canonical reaction event.
- Moderated reactions are excluded from public discovery but remain subject to
  owner/admin access rules.

## Success Criteria

- At least 99% of successfully published reaction comments contain a valid
  `q` reference and matching NIP-92 metadata.
- A usage lookup returns all indexed comments citing the exact reaction event,
  with no thread-tag ambiguity.
- The uploader can use a successfully uploaded reaction immediately.
- Picker search reaches usable results within one second at the 95th percentile
  when the search relay is healthy.
- Inline reactions introduce no WCAG 2 A/AA violations and honor reduced
  motion.
- Publication failure never loses the user's selected reaction or draft text.

## Delivery Boundary

The first implementation may ship personal/recent reactions, NIP-50 search,
upload, `q`-linked publication, inline rendering, and exact-event usage counts.
Public pack creation, blob-level aggregate counts, recommendations, and
reaction analytics beyond usage count are follow-up work.
