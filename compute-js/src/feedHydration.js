// ABOUTME: Compacts Funnelcake video payloads for edge-injected feed hydration JSON
// ABOUTME: Strips bulky Nostr event data but keeps fields transformFunnelcakeVideo needs

/**
 * Build the compact video object embedded in window.__DIVINE_FEED__.
 *
 * `platform`, `classic`, and `tags` must survive: the SPA's
 * transformFunnelcakeVideo derives isVineMigrated and archivedLoopCount
 * from them (Classic Viner badge + archived loop counts on the classics feed).
 */
// Map a Funnelcake v2 envelope ({ data, pagination }) to the client's expected
// shape ({ videos, next_cursor, has_more }). Legacy v1 arrays and already-shaped
// payloads pass through untouched — the client normalizes those itself.
export function normalizeFeedResponse(feedData) {
  if (!feedData || Array.isArray(feedData)) return feedData;
  if (Array.isArray(feedData.data)) {
    const pagination = feedData.pagination ?? {};
    return {
      videos: feedData.data,
      next_cursor: pagination.next_cursor ?? undefined,
      has_more: pagination.has_more ?? false,
    };
  }
  return feedData;
}

export function compactVideoForHydration(v) {
  return {
    id: v.id, pubkey: v.pubkey, kind: v.kind, d_tag: v.d_tag,
    title: v.title, content: v.content, thumbnail: v.thumbnail,
    video_url: v.video_url, created_at: v.created_at,
    reactions: v.reactions, comments: v.comments, reposts: v.reposts,
    loops: v.loops, views: v.views, engagement_score: v.engagement_score,
    author_name: v.author_name, author_avatar: v.author_avatar,
    platform: v.platform, classic: v.classic, tags: v.tags,
  };
}
