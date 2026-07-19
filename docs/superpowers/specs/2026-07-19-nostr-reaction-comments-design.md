# Nostr-Native Reaction Comments

**Date:** 2026-07-19
**Status:** Design review iteration 2
**Initial client:** Divine Web
**Scope:** Reusable animated reactions in NIP-22 video comments, including
verified discovery of the videos that use a reaction.

## Summary

A reusable reaction is a signed NIP-94 `kind:1063` event. A comment using that
reaction is a standard NIP-22 `kind:1111` event with:

- the normal uppercase root and lowercase parent tags;
- exactly one `q` tag citing the canonical `kind:1063`;
- one matching NIP-92 `imeta` tag; and
- optional human-written caption text.

The standard interoperability query is:

```json
{
  "kinds": [1111],
  "#q": ["<reaction-1063-event-id>"]
}
```

That query finds citations. Divine's public count and "videos using this
reaction" list are stricter: Funnelcake exposes only verified uses whose
comment, citation, media metadata, root video, and moderation state all agree.

The first product launch is web-only, Divine-hosted, and fail-closed. It does
not autoplay arbitrary third-party media, use unreviewed uploads, or treat raw
relay counts as trusted usage counts.

## Problem

People should be able to answer a video with a short visual reaction without
depending on a proprietary GIF catalog. The reaction needs a stable identity
that remains portable across Nostr clients. The comment must also cite that
identity in an indexed tag so clients can find the videos participating in the
same visual conversation.

Existing Divine comments are text-only. Existing Funnelcake handling of
`kind:1063` assumes audio metadata. Adding reactions without first separating
media roles would pollute sound discovery and recommendations. Search and
moderation prerequisites therefore ship before the composer.

## Product Contract

### Composer behavior

- A comment may contain one reaction and optional caption text.
- Reaction-only comments are valid.
- Text-only comments remain valid.
- The submit button is enabled when trimmed caption text is non-empty or a
  ready reaction is selected.
- Selecting another reaction replaces the current selection after confirmation
  only when an upload is still in progress. Otherwise replacement is
  immediate.
- A selected reaction has visible Remove and Replace actions.
- Closing the comment modal preserves all server-backed and serializable draft
  state for seven days. A local file whose byte transfer has not completed
  cannot survive refresh; closing during transfer asks whether to keep the
  modal open or cancel the transfer and reselect later.
- A comment cannot be published while its selected upload is pending,
  rejected, or failed.

The published `content` is deterministic:

```text
<optional caption followed by one newline>
https://media.divine.video/<sha256>.mp4
nostr:nevent1...
```

The caption line is omitted when empty. The renderer hides only the exact media
URL and `nostr:nevent` token that match the validated reaction attachment. It
does not remove arbitrary links or Nostr references from human-written text.

### Picker behavior

The picker opens as a non-modal anchored popover at widths of at least 768 CSS
pixels. Below 768 pixels it becomes an internal full-height picker pane inside
the existing comments dialog, not a second portaled modal. The existing
comments dialog remains the only focus trap. The picker contains:

1. Search
2. Personal reactions
3. Approved catalog results
4. Upload new

The picker supports one selection, never multi-select. Personal reactions are
the signed-in user's valid, authored `kind:1063` events tagged
`["t", "reaction"]`. This makes the library portable across devices. A bounded
local cache of the last 24 selected event IDs supplies Recents; it is an
optimization, not the source of truth.

Public catalog search is enabled only when at least 250 Active reactions are
indexed. Before that threshold, users see their personal library and Upload
new. Empty public search ranks reactions by verified unique-video uses over the
previous seven days. Text search ranks normalized textual relevance first and
uses verified usage as a tie-breaker.

Selecting an option closes the picker and returns focus to its trigger. A
restored draft is announced once and exposes Discard draft. Successful
publication clears the draft, announces success, and returns focus to the
composer input.

Removing a personal reaction hides it locally and may publish a NIP-09
`kind:5` deletion request for an event owned by the current user. The UI says
that Nostr deletion is a request and does not promise global erasure. Editable
NIP-51 reaction packs are deferred.

### Usage discovery

The reaction detail surface shows:

- the reaction preview and alt text;
- its author;
- a verified use count; and
- a cursor-paginated list of root videos using it.

An explicit "View reaction details" button beside the attachment navigates to
`/reactions/<event-id>`. It never makes the media itself an implicit link.
Browser Back restores focus to that button when the originating comment is
still mounted. The detail page uses a Load more button, not automatic infinite
scroll. It exposes loading with `aria-busy`, a textual empty state, an inline
retry action on error, and a polite announcement when more videos are appended.

The count and list cover events indexed by Divine's configured Funnelcake
ingest, not the entire Nostr network. The UI labels this "Used in N Divine
videos," not "Used everywhere."

The list deduplicates addressable videos by `A` address and falls back to `E`
event ID for non-addressable roots. A deleted or newly restricted reaction
keeps historical comments as signed Nostr data, but Divine stops rendering its
media and removes its uses from public catalog surfaces until policy permits
them again.

## Standards

| Concern | Standard | Divine use |
| --- | --- | --- |
| Comment thread | NIP-22 | `kind:1111`, uppercase root, lowercase parent |
| Inline media | NIP-92 | Content URL plus matching `imeta` |
| Reaction identity | NIP-94 | `kind:1063` file metadata event |
| Reaction citation | NIP-18 / NIP-22 | Indexed `q` tag |
| Raw search | NIP-50 | Interoperability and diagnostics only |
| Raw count | NIP-45 | Approximate citation count only |
| Media storage | Blossom | Divine upload and content-addressed retrieval |
| Deletion request | NIP-09 | Owner-authored `kind:5` |
| Future personal packs | NIP-51 | Deferred |

`duration` is a Divine NIP-94 extension field, not a normative NIP-94 field.
NIP-30 custom emoji rendering is not used because it does not define this
`kind:1111` attachment and citation model.

## Protocol Encoding

### Canonical reaction event

A reusable reaction is a signed NIP-94 event:

```json
{
  "kind": 1063,
  "content": "A person giving a skeptical side-eye",
  "tags": [
    ["url", "https://media.divine.video/<sha256>.mp4"],
    ["m", "video/mp4"],
    ["x", "<sha256>"],
    ["size", "183240"],
    ["dim", "480x480"],
    ["duration", "2.4"],
    ["thumb", "https://media.divine.video/<thumb-sha256>.webp"],
    ["alt", "A person giving a skeptical side-eye"],
    ["t", "reaction"],
    ["t", "side-eye"],
    ["t", "skeptical"]
  ]
}
```

The event ID is the canonical social identity. The `x` tag is the canonical
blob identity. Catalog results may group duplicate blobs by `x`, but a comment
always cites the exact selected event ID and preserves that event's authorship.
The NIP-94 `thumb` value maps to the NIP-92 `imeta` `image` value; verification
treats those names as the same thumbnail field.

A reaction candidate is valid only when it has:

- kind `1063`;
- exactly one valid `url`, `m`, `x`, `dim`, and `alt` value;
- one `["t", "reaction"]` marker;
- a supported non-audio media MIME;
- a 64-character lowercase hexadecimal SHA-256;
- an HTTPS Divine media URL for autoplay eligibility; and
- an Active moderation state for both event ID and blob hash.

For the MVP, a new reaction event's author must match the owner pubkey in the
Divine upload receipt. Other people reuse the existing canonical event by
citing it; they do not mint duplicate authorship for the same Divine-hosted
blob. Funnelcake excludes owner/hash duplicates and conflicting descriptors
from the catalog.

### Reaction comment

```json
{
  "kind": 1111,
  "content": "that look says everything\nhttps://media.divine.video/<sha256>.mp4\nnostr:nevent1...",
  "tags": [
    ["E", "<root-video-event-id>", "<relay-hint>", "<root-author>"],
    ["A", "34236:<root-author>:<d-tag>", "<relay-hint>"],
    ["K", "34236"],
    ["P", "<root-author>", "<relay-hint>"],
    ["e", "<parent-event-id>", "<relay-hint>", "<parent-author>"],
    ["k", "<parent-kind>"],
    ["p", "<parent-author>", "<relay-hint>"],
    ["q", "<reaction-event-id>", "<relay-hint>", "<reaction-author>"],
    [
      "imeta",
      "url https://media.divine.video/<sha256>.mp4",
      "m video/mp4",
      "x <sha256>",
      "dim 480x480",
      "image https://media.divine.video/<thumb-sha256>.webp",
      "alt A person giving a skeptical side-eye"
    ]
  ]
}
```

For a top-level comment, lowercase parent tags reference the root video. For a
reply, they reference the immediate `kind:1111` parent. The reaction is never
placed in `e`, `E`, `a`, `A`, `k`, or `K`.

Generated comments contain exactly one supported reaction `q` and one
corresponding `imeta`. A future multi-attachment design requires a new review;
the parser does not guess among multiple reaction candidates.

### Verified-use predicate

A raw `#q` match is a citation, not proof that the cited media was used. A
comment becomes a Divine verified use only when all checks pass:

1. The `kind:1111` signature and event ID are valid.
2. There is exactly one supported reaction `q`.
3. The cited event exists, has a valid signature and event ID, and is
   `kind:1063`.
4. The `q` author field matches the cited event's pubkey.
5. The cited event is marked as a reaction and has supported media metadata.
6. The comment has exactly one matching reaction `imeta`.
7. `imeta` URL, MIME, SHA-256, dimensions, and thumbnail match the cited
   event's canonical descriptor.
8. The exact media URL and exact `nostr:nevent` citation appear in `content`.
9. The uppercase NIP-22 root resolves to a valid indexed video. `A`, `E`, `K`,
   and `P` are mutually consistent.
10. The reaction event, author, blob hash, root video, and comment pass current
    moderation policy.

Any failed or unknown check is fail-closed for Divine counts, lists, catalog
ranking, and autoplay. Funnelcake recomputes validity when moderation or source
events change.

Raw relay clients remain free to query `#q`. NIP-45 counts of those matches are
displayed only in developer diagnostics as unverified citation counts. Divine
product surfaces use the verified Funnelcake index.

## Backend Architecture

### Media-role separation

Before ingesting reaction media, Funnelcake separates `kind:1063` records by
product role:

- audio: supported audio MIME and existing sound metadata rules;
- reaction: supported non-audio MIME, `["t", "reaction"]`, valid reaction
  descriptor;
- other: retained as generic NIP-94 metadata but excluded from both products.

Reaction records must not enter the existing audio read model, sound pages,
Gorse items, or sound recommendations. Audio records must not enter the
reaction catalog.

Funnelcake's search migration currently omits `kind:1063`; the reaction read
model receives its own searchable normalized fields and moderation join rather
than broadening the existing video/text index indiscriminately.

### Proposed REST contract

```text
POST /api/reactions/search
GET /api/reactions/<event-id>
GET /api/reactions/<event-id>/uses?cursor=<opaque>&limit=<n>
```

The versioned search request keeps user text out of URLs:

```json
{
  "schema": "divine.reaction-search.v1",
  "search": "side eye",
  "cursor": null,
  "limit": 20
}
```

All success responses use:

```json
{
  "schema": "divine.reaction-page.v1",
  "items": [
    {
      "event_id": "<1063-id>",
      "author_pubkey": "<pubkey>",
      "url": "https://media.divine.video/<x>.mp4",
      "mime": "video/mp4",
      "sha256": "<x>",
      "width": 480,
      "height": 480,
      "duration_ms": 2400,
      "thumbnail_url": "https://media.divine.video/<thumb-x>.webp",
      "thumbnail_sha256": "<thumb-x>",
      "alt": "A person giving a skeptical side-eye",
      "state": "Active",
      "state_version": 7,
      "verified_video_count": 42
    }
  ],
  "next_cursor": "<opaque-or-null>"
}
```

The detail endpoint returns the same descriptor or `404` when missing or
policy-hidden; it does not reveal which. The uses endpoint returns:

```json
{
  "schema": "divine.reaction-uses.v1",
  "reaction_event_id": "<1063-id>",
  "verified_video_count": 42,
  "items": [
    {
      "root_address": "34236:<pubkey>:<d-tag>",
      "root_event_id": "<event-id>",
      "comment_event_id": "<1111-id>"
    }
  ],
  "next_cursor": "<opaque-or-null>"
}
```

`verified_video_count` means unique verified root videos, not comments.
`limit` defaults to 20 and is capped at 50. Cursors are opaque and stable for
the response ordering. Invalid input returns `400` with a versioned
machine-readable code, unavailable dependencies return `503`, and quota
responses return `429` plus `Retry-After`. Search requests are debounced by
250 ms and canceled when input changes.

The catalog response contains only Active reaction descriptors. Funnelcake's
configured relay ingest defines the completeness boundary. Relay result caps
do not truncate the REST cursor. Search request bodies are redacted at the CDN,
proxy, application, tracing, error-reporting, and analytics layers. The MVP
does not retain raw or normalized search terms server-side.

No NIP-50 or NIP-45 support is required from the web client's relay pool for
the product experience. Those standards remain useful for external clients and
diagnostics.

### Moderation ownership

Divine Blossom owns upload scanning, canonical derivative generation, blob
state, and blob blocking. Funnelcake joins that state with event, author,
comment, and root-video policy to own catalog and verified-use eligibility.
The web client consumes those decisions and fails closed on unknown state.

Moderation states are:

- Pending
- Active
- AgeRestricted
- Restricted
- Banned
- Deleted

The MVP catalog and composer accept only Active reactions. Age-restricted
reaction media is excluded rather than introducing a second age-verification
flow inside comments. Reports name the reaction event ID, uploader pubkey, and
blob `x`. Reporting the surrounding comment is a separate action because the
comment author may differ from the reaction author.

### Moderation state propagation

Blossom is authoritative for a canonical blob's state. Each state change writes
a durable transactional outbox record with schema
`divine.reaction-blob-state.v1`, keyed by canonical SHA-256 and a monotonically
increasing `state_version`. The record binds:

- upload ID and owner pubkey;
- source, canonical, and thumbnail SHA-256;
- canonical and thumbnail URL;
- MIME, dimensions, duration, and byte sizes;
- moderation state and reason code;
- state version and transition timestamp; and
- the Blossom service signature.

Blossom pushes signed records to an authenticated internal Funnelcake consumer.
The push channel uses mutual TLS in addition to the same Ed25519/RFC 8785
service signature as the public receipt. Funnelcake verifies the pinned service
key, applies records idempotently by `(canonical_sha256, state_version)`,
rejects older versions, and invalidates reaction catalog and verified-use
materializations in the same transaction. The outbox retries with exponential
backoff for 24 hours and moves exhausted deliveries to an alerted dead-letter
queue.

A pull reconciliation endpoint exposes the same signed records by
`updated_after` and opaque cursor. Funnelcake reconciles every five minutes and
runs a nightly full comparison/backfill, so missed push deliveries repair
without trusting the public client. Restricted, Banned, and Deleted transitions
must reach Funnelcake within 60 seconds at p95.

Blossom blocks the canonical media at the origin immediately on a restrictive
transition and purges its CDN key. Funnelcake responses use
`Cache-Control: private, max-age=30, must-revalidate` and include
`state_version`. Web revalidates a visible attachment when its decision is more
than 30 seconds old; an origin block remains the final fail-closed control if a
client or cache is stale.

## Upload Pipeline

The MVP uploads local files only to Divine Blossom. It does not accept remote
URL imports, arbitrary Blossom servers, or the user's `kind:10063` preferred
server list. Preferred-server support is deferred until routing, SSRF, auth,
moderation, and availability rules are designed across clients.

Reaction ingestion is a Divine job API beside standard Blossom BUD-02; it does
not change ordinary Blossom upload behavior or make all Pending blobs private.
Its endpoints are:

```text
POST   /api/reaction-uploads
PUT    /api/reaction-uploads/<upload-id>/source
GET    /api/reaction-uploads/<upload-id>
DELETE /api/reaction-uploads/<upload-id>
```

The create body uses schema `divine.reaction-upload-create.v1` and contains a
client-generated UUID idempotency key, source SHA-256, source byte length,
declared source MIME, alt text, and search tags. Every operation carries a
fresh NIP-98 `kind:27235` authorization signed by the active user, bound to the
exact URL, method, and SHA-256 of the request body. Authorization expires after
60 seconds through an `expiration` tag. The server verifies the signature,
signer, timestamp, request hash, content length, operation, and upload
ownership. It records each authorization event ID until expiry. Replaying the
same authorization returns the already-recorded idempotent response and never
runs work or consumes quota twice.

Create returns an opaque upload ID, source URL, status URL, expiry, and current
state. Repeating create with the same pubkey and idempotency key returns the
same upload. Reusing the key with different input returns `409`. The raw source
PUT is additionally bound to the declared source SHA-256 and is one-time:
repeating identical bytes returns the existing job, while different bytes
return `409`. Ambiguous timeouts are resolved with authenticated GET, never by
creating another job.

Source bytes and intermediate derivatives live in a reaction-job quarantine
namespace that has no public GET route. After validation and Active
classification, Blossom promotes only the canonical derivative and thumbnail
to their content-addressed public paths. Standard Blossom Pending access rules
outside this namespace remain unchanged.

Status returns schema `divine.reaction-upload-status.v1`:

```json
{
  "upload_id": "<opaque>",
  "owner_pubkey": "<pubkey>",
  "idempotency_key": "<uuid>",
  "state": "Active",
  "state_version": 7,
  "source_sha256": "<source-x>",
  "canonical_sha256": "<x>",
  "canonical_url": "https://media.divine.video/<x>.mp4",
  "canonical_mime": "video/mp4",
  "canonical_size": 183240,
  "thumbnail_sha256": "<thumb-x>",
  "thumbnail_url": "https://media.divine.video/<thumb-x>.webp",
  "thumbnail_size": 24182,
  "width": 480,
  "height": 480,
  "duration_ms": 2400,
  "reason_code": null,
  "retry_after_seconds": null,
  "receipt_expires_at": 1780000000,
  "service_key_id": "blossom-reaction-2026-01",
  "service_signature": "<signature-over-canonical-json>"
}
```

The web client verifies the receipt against a pinned Blossom service public
key before signing `kind:1063`. The signature is Ed25519 over RFC 8785
canonical JSON with the signature field omitted; `service_key_id` supports
audited rotation. Funnelcake independently receives and verifies the
corresponding outbox record; it never trusts a client-supplied receipt. Only
the receipt owner may publish the initial catalog event for that blob in the
MVP.

States are `AwaitingSource`, `Processing`, `Pending`, `Active`, `Rejected`,
`Canceled`, and `Expired`. Active, Rejected, Canceled, and Expired are terminal.
GET supplies `Retry-After`; the client starts at two-second polling and honors
backoff up to 15 seconds. DELETE is idempotent, owner-authenticated, and
succeeds only before Active. An ambiguous DELETE is resolved by GET.

Allowed source formats are GIF, animated WebP, and MP4. Shared client/server
constants enforce:

- maximum source size: 10 MiB;
- maximum duration: 6 seconds;
- maximum width or height: 1080 pixels;
- maximum pixels per frame: 2,073,600;
- maximum decoded frames: 120;
- maximum total decoded pixels: 120,000,000;
- maximum canonical MP4 size: 3 MiB;
- maximum thumbnail size: 256 KiB;
- worker memory: 512 MiB;
- worker CPU time: 15 seconds;
- worker wall-clock time: 20 seconds;
- required alt text: 1–280 Unicode characters; and
- at most 8 normalized search tags, each 1–32 characters.

Alt text and tags are Unicode NFC-normalized, trimmed, and rejected when they
contain C0/C1 controls, bidi override controls, or invalid Unicode. Search tags
are case-folded for indexing while the signed event retains the sanitized
display text.

The server sniffs and decodes the file instead of trusting extension or
declared MIME. It strips metadata and audio, then produces:

- a muted H.264 MP4 canonical derivative; and
- a static WebP thumbnail.

Both outputs are content-addressed and size-checked. The upload API enforces,
per pubkey and IP, at most 2 concurrent uploads, 10 uploads per rolling hour,
and 50 MiB of accepted sources per day. Reaction search is limited to 60
requests per minute and use-list requests to 30 per minute. A `429` includes a
retry delay; the client backs off without discarding the draft.

### Publication state machine

```text
idle
  -> selecting
  -> uploading
  -> moderating
  -> publishingMetadata
  -> ready
  -> publishingComment
  -> idle
```

Every active state may enter `failed` with a retry target. While Pending, only
the uploader sees a local object-URL preview during the current page lifetime.
Other clients never receive or fetch pending media. The client publishes the
`kind:1063` only after the canonical derivative is Active, and publishes the
comment only after the signed metadata event is accepted by at least one
configured write relay.

Drafts live in a versioned IndexedDB store scoped by current pubkey, root video
address/ID, and parent event ID. A schema validator rejects unknown or corrupt
records. The record stores caption text, selected existing descriptor, upload
ID, canonical hashes, verified receipt, publication state, and an already
signed event only after an ambiguous relay timeout. It stores no source bytes,
object URLs, private keys, or auth headers.

Drafts expire after seven days and are removed on success, explicit discard,
or logout. Each pubkey sees only its own namespace. Draft records are excluded
from analytics and support exports. When a draft is restored after refresh:

- an incomplete source transfer requires file reselection;
- a completed server upload resumes authenticated status polling by upload ID;
- an Active receipt resumes metadata publication; and
- an ambiguous relay publication reuses the exact stored signed event.

Closing the modal during server processing, moderation, or relay publication
does not cancel the server job; reopening restores its status. Closing during
source transfer presents Keep uploading and Cancel upload. Cancel aborts the
transfer, issues authenticated DELETE when an upload ID exists, retains the
caption, and marks the file for reselection. On restore, focus lands on the
composer input after a one-time draft-restored announcement.

Retries reuse the canonical blob hash and exact signed event. Before signing a
replacement metadata event, the client queries configured write relays for the
known event ID. Before retrying the comment, it similarly checks the known
comment ID. This prevents double publication caused by an ambiguous timeout.

Canceling an upload stops local work and requests best-effort deletion of an
owned unreferenced job. A server cleanup job removes expired quarantined
sources and derivatives. It checks both its event-reference audit trail and
Funnelcake before deleting an Active blob, so local hide or a NIP-09 request
never becomes accidental media deletion. Published Nostr events remain
governed by NIP-09 semantics.

## Rendering and Accessibility

A dedicated `ReactionAttachment` renders only a validated descriptor. Generic
`NoteContent` remains responsible for text and links.

- The attachment reserves the validated aspect ratio to prevent layout shift.
- It is a `figure` with one accessible description, "Reaction: <alt>." The
  media element is hidden from the accessibility tree; a `figcaption` exposes
  the alt text once, independently of the human comment caption.
- Active Divine media may autoplay muted and loop while visible, but every
  animated attachment has a visible Pause/Play button named with its alt text.
- It uses `preload="none"`, `playsInline`, `muted`,
  `crossOrigin="anonymous"`, and `referrerPolicy="no-referrer"`.
- Playback pauses off-screen. An explicit user pause is sticky for that
  attachment during the page session and intersection changes never override
  it.
- With reduced motion, the static thumbnail renders first and animation begins
  only after an explicit Play action. Visibility or focus never starts it.
- Unknown, Pending, restricted, blocked, malformed, or mismatched media never
  autoloads. The unavailable figure is named "Reaction unavailable" and retains
  safe comment text.
- Valid third-party NIP-92 media is a normal external link with a warning,
  `target="_blank"`, `rel="noopener noreferrer"`, and no inline fetch or
  preview until Divine has sanitized and indexed it.
- Broken media falls back to alt text and the cited `nevent` link. It does not
  repeatedly announce a load error.
- Reply previews and notifications show optional caption plus "Reaction"
  instead of raw machine-generated URL/citation lines.

All Play, Pause, View details, Remove, Replace, Upload, Cancel, Retry, and
selection targets are at least 44 by 44 CSS pixels. Multiple visible reactions
may animate, but every one remains independently pausable; coordinating a
single global animation is deferred.

### Picker interaction

The picker uses the ARIA combobox-with-listbox pattern, not a hybrid grid:

- the search input owns focus while results are open;
- it has `role="combobox"`, `aria-controls`, `aria-expanded`, and
  `aria-activedescendant`;
- the visually tiled results container has `role="listbox"`;
- each result has a stable event-ID-derived DOM ID, `role="option"`, an
  accessible name containing alt text and author, `aria-selected`, and a
  visible non-color selected indicator;
- Down Arrow opens results and moves to the next option, Up Arrow moves to the
  previous option, Home/End move to first/last, and Enter selects;
- Left/Right retain ordinary text-caret behavior in the search field;
- Personal and Catalog are labeled groups in one ordered list; Up/Down crosses
  the group boundary;
- asynchronous replacement preserves the active event ID when it still exists
  and otherwise activates the first result without moving DOM focus;
- pointer hover never changes keyboard focus or the active descendant; and
- Escape closes the picker and returns focus to the reaction trigger. A second
  Escape may then close the comments dialog.

The desktop popover is at most 560 by 520 CSS pixels. On narrow screens, the
internal picker pane fills the comments dialog's content box using `100dvh`
and safe-area padding. The parent dialog owns background inertness. The picker
pane owns one scrolling result region; search and Upload new remain sticky.
The virtual keyboard resizes that region rather than creating body scroll. The
pane has its own visible title, description, and Back action. Closing it
restores the trigger before the parent dialog can close.

The upload form has a labeled native file input, accepted formats and numeric
limits shown before selection, a required alt-text field with associated
inline errors, optional search tags, preview, and stage-specific Cancel/Retry.
Upload rejection focuses the error summary and links each error to its field.
Transfer progress uses a labeled `progressbar`; processing and moderation use
`aria-busy`. Progress announcements are throttled to stage changes and 25%
milestones. Ordinary updates use a polite status region; only blocking failures
use an alert.

Loading and result count are announced politely. Successful selection is
announced once before the picker closes. Thumbnail placeholders retain stable
dimensions and result order. Manual acceptance includes VoiceOver/Safari and
NVDA/Chrome because automated accessibility checks cannot validate these
focus, announcement, and motion behaviors.

## Failure Behavior

- **Catalog unavailable:** show cached personal reactions and Upload new.
- **Catalog below cold-start threshold:** omit public search without an error.
- **Relay cannot fetch personal events:** show Recents and Upload new.
- **Upload rejected:** retain caption and rejection receipt, retain local file
  metadata only for the current page lifetime, explain the violated limit or
  moderation state, and do not publish.
- **Upload canceled:** remove local preview and run best-effort orphan cleanup.
- **Metadata relay timeout:** retain the exact signed event and verify its ID
  before retry.
- **Comment relay timeout:** retain the exact signed comment and verify its ID
  before retry.
- **Reaction reclassified after publication:** stop autoplay and remove it from
  public search/count/list while retaining a safe unavailable placeholder.
- **Malformed comment:** render its ordinary human text and safe links, but not
  a reaction attachment.
- **Funnelcake use endpoint unavailable:** show "Usage unavailable"; do not
  substitute a raw relay count as verified.

## Privacy and Abuse Controls

- Public reactions, comments, and citations are signed public Nostr data.
- The upload UI says the reaction may be reused by other people and deletion
  cannot be guaranteed across Nostr.
- Client telemetry never records caption text, alt text, raw search text,
  media bytes, or Nostr private material.
- Search telemetry records only query-length buckets and result count.
- IndexedDB drafts are isolated by pubkey, schema-validated, expired after
  seven days, and cleared on success, discard, or logout.
- Media is decoded in isolated, resource-limited server workers.
- Redirects and arbitrary outbound fetches are absent from the MVP pipeline.
- Existing CSP media origins are changed only if the fixed Divine media origin
  requires it.
- Mute and report decisions are applied before rendering or counting.
- A reaction report propagates by event ID and blob hash to every indexed use;
  a comment report affects that comment independently.

## Delivery Slices

Each slice is independently deployable and reviewable. Backend changes deploy
before the web feature flag is enabled.

### 0. Funnelcake and Blossom prerequisites

- Separate audio, reaction, and other `kind:1063` media roles.
- Add the moderated reaction read model and search endpoint.
- Add verified-use validation, count, and cursor-paginated root-video endpoint.
- Add the authenticated reaction-job API, quarantine namespace, signed
  receipts, sanitization, quotas, moderation outbox, reconciliation, and
  cleanup.
- Add metrics and alerting.

### 1. Pure web protocol model

- Add pure NIP-94 reaction parser and descriptor validation under `src/lib`.
- Add pure `kind:1111` builder and verified attachment parser.
- Test top-level and nested NIP-22 tags, exact `q`/`imeta` matching, malformed
  events, and machine-token stripping.

### 2. Safe inline rendering

- Render valid existing reaction comments with `ReactionAttachment`.
- Add reduced-motion, broken-media, notification, and reply-preview behavior.
- Keep third-party or unverified media as warning-labeled external links.

### 3. Select and publish existing reactions

- Add the one-reaction composer model and deterministic content.
- Add personal authored reactions and approved REST catalog selection.
- Preserve and retry drafts with idempotent signed-event reuse.

### 4. Upload and publish new reactions

- Add local validation, alt/search metadata form, upload pipeline, progress,
  cancellation, moderation wait, and metadata publication.
- Never publish a comment before the reaction reaches Active and its
  `kind:1063` is relay-visible.

### 5. Picker completion

- Add responsive popover/internal-pane behavior, catalog cold-start gate,
  Recents, combobox/listbox navigation, live announcements, and local owner
  hide/delete requests.

### 6. Usage discovery

- Add reaction detail and cursor-paginated "videos using this reaction."
- Display verified Divine count and scope language.
- Add independent reaction and comment reporting.

Mobile publication and rendering are a separate parity project. Mobile can
continue to treat these comments as ordinary text/links until it implements
the same parser. Preferred Blossom servers and NIP-51 packs are later designs.

## Test Strategy

### Protocol and validator tests

- Generated comments have 100% valid NIP-22 root/parent tags.
- Generated reaction comments have exactly one valid `q` and matching `imeta`.
- Reaction `q` never changes thread ancestry.
- Caption extraction removes only exact generated machine tokens.
- Every verified-use predicate failure is rejected independently.
- Addressable roots deduplicate by `pubkey:kind:d`, not event ID.

### Backend tests

- Reaction `kind:1063` never enters audio/Gorse models.
- Audio `kind:1063` never enters reaction results.
- Search, moderation, cursors, ranking, and cold-start counts are deterministic.
- Citation poisoning with mismatched `q`, author, `imeta`, URL, MIME, `x`, root,
  or moderation state never creates a verified use.
- Reclassification invalidates catalog and usage materializations.
- Decoder bombs, MIME lies, metadata, audio tracks, oversize files, quotas, and
  orphan cleanup are covered.
- Expired/replayed auth, body-hash mismatch, conflicting idempotency keys,
  altered receipts, author/receipt mismatch, ambiguous timeouts, out-of-order
  state versions, dead-letter replay, and reconciliation repair are covered.
- Shared versioned fixtures are accepted identically by Blossom, Funnelcake,
  and web.

### Web component tests

- Text-only, reaction-only, and caption-plus-reaction submission.
- Select, replace, remove, cancel, retry, modal close, refresh, and seven-day
  draft expiry.
- Exact signed-event reuse after ambiguous relay timeouts.
- Search debounce/cancel, empty/error/offline, cold start, pagination, and
  deduplication.
- Combobox/listbox semantics, focus return, live announcements, alt text, and
  reduced motion.
- Active, unknown, blocked, malformed, broken, and third-party render states.

### End-to-end tests

- Existing reaction selection through signed `1111` relay publication.
- Upload through sanitization, Active state, `1063`, and `1111` publication.
- A second web session discovers and renders the signed comment.
- Usage detail lists the correct unique root videos from verified uses.
- Desktop, mobile-width internal pane, keyboard-only, reduced-motion, offline,
  and upload-rejection Playwright paths.
- Axe WCAG 2 A/AA checks introduce no violations.

## Observability and Rollout

Funnelcake's operational configuration store is the reaction flag control
plane. `GET /api/client-config?client=web&version=<build>` returns separately
versioned controls for:

- safe attachment rendering;
- attachment autoplay;
- catalog search;
- existing-reaction publication;
- reaction upload; and
- usage detail.

Each control includes enabled state, rollout percentage, opaque bucket salt,
configuration version, and expiry. Web assigns a stable bucket from the flag
key, salt, and signed-in pubkey, falling back to a per-install random ID for
logged-out rendering. Configuration is cached for five minutes. If refresh
fails, the last response is usable for at most 15 minutes, after which all
reaction network fetch, autoplay, catalog, publication, upload, and usage
surfaces fail closed. Existing comments retain safe text, alt, and citation
links. Production builds ignore localStorage overrides for these flags.

The control plane is audited. SLO automation may only reduce a rollout or
disable a control; it cannot enable or expand one. The Funnelcake on-call may
manually disable or restore a previously approved percentage after reviewing
the trigger. Disabling composer/upload leaves valid signed data and migrations
in place. Rendering/autoplay has a separate kill switch so a media incident
does not require destructive rollback.

Deployment order is:

1. Deploy the reaction-job quarantine and state API in Blossom with no web
   caller.
2. Enable signed outbox delivery, Funnelcake consumption, reconciliation, and
   revocation alerts.
3. Deploy Funnelcake schema/backfill in shadow mode and verify reactions never
   enter audio/Gorse.
4. Compare verified-use fixtures and catalog health while every web flag is
   off.
5. Deploy web protocol and rendering code with every reaction flag off.
6. Trust & Safety approves at least 250 staff- or community-authored reactions;
   Community Operations owns the bootstrap queue and escalation handoff.
7. Run a staff-only composer beta through slices 3–5.
8. Ship public 5%, 25%, and 100% rollout only after usage discovery slice 6 is
   deployed, so the public feature includes the user's core
   videos-using-reaction flow.

Media Platform owns Blossom ingestion and upload latency. Trust & Safety owns
state policy and escalations. Data Platform owns Funnelcake classification,
verified uses, and reconciliation. Web owns composer, rendering, drafts, and
accessibility. Each owner supplies an on-call runbook before its flag can leave
staff-only rollout.

Privacy-safe counters and histograms cover:

- picker opened, source selected, selection removed, and publish outcome;
- upload accepted/rejected, stage duration, moderation result, and cleanup;
- search latency, result-count bucket, and zero-result rate;
- metadata/comment relay acceptance and ambiguous-timeout recovery;
- verified-use rejection reason;
- attachment render/fallback reason; and
- report rate by surface, without content.

Upload stages and moderation/cleanup metrics originate in Blossom. Verified-use
and relay acceptance metrics originate in Funnelcake. Consent-aware picker and
fallback metrics originate in web product analytics. Crash-free sessions
originate in Sentry. Raw search terms are absent from all four sources.

Automatic flag reduction or disable occurs when:

- any unreviewed or non-Active reaction autoloads publicly;
- any generated published reaction comment lacks a valid matching `q`/`imeta`;
- publish failure exceeds 5% for 30 minutes;
- p95 catalog latency exceeds 2 seconds for 30 minutes; or
- crash-free sessions regress by more than 0.5 percentage points.

## Success Criteria

- 100% of generated published reaction comments pass the shared protocol
  validator; one malformed event is a release blocker.
- At least 95% of existing-reaction submit attempts reach relay acceptance.
- p95 catalog search is below 1 second under normal service health.
- p95 automatically approved upload-to-Active time is below 15 seconds. Jobs
  routed to manual review are measured separately and remain unusable while
  Pending.
- Aggregate zero-result rate for non-empty searches is below 20% after two
  weeks at full rollout, measured without retaining query text.
- At least 35% of picker opens produce a published reaction comment after the
  first two weeks; this is evaluated alongside cancellation and error rates,
  not used to pressure users.
- Verified-use count and pages contain no known citation-poisoning false
  positives.
- Reduced-motion, keyboard, and screen-reader paths pass their automated and
  manual acceptance checks.
- Publication failure never loses caption text, selected reaction, upload
  receipt, or already-signed events within the seven-day draft lifetime.

## Rejected Alternatives

### Use `kind:34236` for reusable reactions

That mixes catalog assets with authored feed videos, pollutes video discovery,
and poorly represents animated images. `kind:34236` remains appropriate for an
original recorded video reply.

### Use only NIP-30 emoji tags

NIP-30 does not define this `kind:1111` attachment behavior, carry the required
file metadata, or create an indexed citation that discovers root videos.

### Trust raw `#q` or NIP-45 counts

Anyone can cite a `kind:1063` while attaching unrelated media. Raw queries are
important for interoperability, but Divine needs the verified-use predicate
for trusted counts, ranking, and lists.

### Upload to arbitrary preferred Blossom servers in the MVP

This expands SSRF, authentication, availability, moderation, and cleanup
boundaries before the core interaction is proven. The signed `kind:1063` and
`1111` events remain portable even though initial sanitization uses Divine
hosting.

### Ship web and mobile publication together

The clients currently have different comment and media models. A web-first
launch keeps the first change reviewable while preserving standard event data
that mobile can render as ordinary links until parity work lands.
